export type SmartDayPeriod = "morning" | "afternoon" | "evening";
export interface SmartTimeWindow { period: SmartDayPeriod; startHour: number; endHour: number; startMinute?: number; endMinute?: number; enabled: boolean; }
export interface SmartCampaignAccount { id: string; platform: string; }
export interface SmartCampaignContent { id: string; }
export interface SmartCampaignConfig { postsPerDay: number; startDate: string; endDate: string; accounts: SmartCampaignAccount[]; contents: SmartCampaignContent[]; minIntervalMinutes?: number; accountStaggerMinutes?: number; windows?: SmartTimeWindow[]; rotationSeed?: string; }
export interface SmartPublicationSlot { accountId: string; platform: string; contentId: string; scheduledFor: string; dayPeriod: SmartDayPeriod; sequence: number; }
const DEFAULT_WINDOWS: SmartTimeWindow[] = [
  { period: "morning", startHour: 9, endHour: 12, enabled: true },
  { period: "afternoon", startHour: 13, endHour: 17, enabled: true },
  { period: "evening", startHour: 18, endHour: 22, enabled: true },
];
function parseDate(value: string) { const [year, month, day] = value.split("-").map(Number); if (!year || !month || !day) throw new Error("Smart Campaign: data inválida"); return { year, month, day }; }
function addCalendarDays(date: { year:number; month:number; day:number }, amount:number) { const d=new Date(Date.UTC(date.year,date.month-1,date.day+amount)); return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()}; }
function compareCalendarDates(a:{year:number;month:number;day:number},b:{year:number;month:number;day:number}) { return Date.UTC(a.year,a.month-1,a.day)-Date.UTC(b.year,b.month-1,b.day); }
function calendarDayCount(start:{year:number;month:number;day:number}, end:{year:number;month:number;day:number}) { return Math.floor(compareCalendarDates(end,start)/86_400_000)+1; }
function saoPauloToIso(date:{year:number;month:number;day:number},totalMinutes:number):string { const hour=Math.floor(totalMinutes/60); const minute=totalMinutes%60; return new Date(Date.UTC(date.year,date.month-1,date.day,hour+3,minute,0,0)).toISOString(); }
function buildDailyTimes(postsPerDay:number,windows:SmartTimeWindow[],maxStaggerMinutes:number):Array<{minutes:number;period:SmartDayPeriod}> {
  const postsByWindow=windows.map((_,index)=>{const base=Math.floor(postsPerDay/windows.length);const remainder=postsPerDay%windows.length;return base+(index<remainder?1:0);});
  const result:Array<{minutes:number;period:SmartDayPeriod}>=[];
  windows.forEach((window,windowIndex)=>{const count=postsByWindow[windowIndex];if(count<=0)return;const start=window.startHour*60+(window.startMinute??0);const end=window.endHour*60+(window.endMinute??0)-maxStaggerMinutes;if(end<start)throw new Error(`Smart Campaign: janela ${window.period} é pequena demais para o stagger configurado`);if(count===1){result.push({minutes:Math.floor((start+end)/2),period:window.period});return;}const available=end-start;for(let position=0;position<count;position++){const offset=Math.floor((available*(position+1))/(count+1));result.push({minutes:start+offset,period:window.period});}});
  return result.sort((a,b)=>a.minutes-b.minutes);
}
function hashSeed(value:string) {
  let hash=2166136261;
  for(let index=0;index<value.length;index++){
    hash^=value.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}
function createSeededRandom(seed:number) {
  let state=seed||0x6d2b79f5;
  return ()=>{
    state+=0x6d2b79f5;
    let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}
function seededShuffle<T>(items:T[],seed:string):T[] {
  const result=[...items];
  const random=createSeededRandom(hashSeed(seed));
  for(let index=result.length-1;index>0;index--){
    const swapIndex=Math.floor(random()*(index+1));
    [result[index],result[swapIndex]]=[result[swapIndex],result[index]];
  }
  return result;
}
export function generateSmartCampaignPlan(config:SmartCampaignConfig):SmartPublicationSlot[] {
  if(!config.accounts.length)throw new Error("Smart Campaign: nenhuma conta selecionada");
  if(!config.contents.length)throw new Error("Smart Campaign: nenhum conteúdo selecionado");
  const postsPerDay=Math.floor(config.postsPerDay);if(postsPerDay<1)throw new Error("Smart Campaign: postsPerDay deve ser maior que zero");
  const startDate=parseDate(config.startDate);const endDate=parseDate(config.endDate);if(compareCalendarDates(endDate,startDate)<0)throw new Error("Smart Campaign: data final anterior à inicial");
  const campaignDays=calendarDayCount(startDate,endDate);const requiredUniqueContentsPerAccount=campaignDays*postsPerDay;
  const uniqueContentIds=new Set(config.contents.map(content=>content.id));
  if(uniqueContentIds.size!==config.contents.length)throw new Error("Smart Campaign: a seleção contém conteúdos duplicados");
  if(config.contents.length<requiredUniqueContentsPerAccount)throw new Error(`Smart Campaign: esta campanha precisa de ${requiredUniqueContentsPerAccount} conteúdos únicos por conta (${campaignDays} dias × ${postsPerDay} posts/dia), mas somente ${config.contents.length} foram selecionados. Adicione mais conteúdos ou reduza o período/posts por dia.`);
  const windows=(config.windows?.length?config.windows:DEFAULT_WINDOWS).filter(window=>window.enabled).sort((a,b)=>a.startHour*60+(a.startMinute??0)-(b.startHour*60+(b.startMinute??0)));if(!windows.length)throw new Error("Smart Campaign: nenhuma janela ativa");
  const rotationSeed=config.rotationSeed||[
    config.startDate,
    config.endDate,
    postsPerDay,
    config.contents.map(content=>content.id).join(","),
  ].join("|");
  const shuffledContents=seededShuffle(config.contents,`${rotationSeed}:contents`);
  const accountOffsets=seededShuffle(
    Array.from({length:config.contents.length},(_,index)=>index),
    `${rotationSeed}:account-offsets`,
  );
  const staggerMinutes=Math.max(0,Math.floor(config.accountStaggerMinutes??7));const minIntervalMinutes=Math.max(0,Math.floor(config.minIntervalMinutes??60));const maxStaggerMinutes=Math.max(0,config.accounts.length-1)*staggerMinutes;const baseTimes=buildDailyTimes(postsPerDay,windows,maxStaggerMinutes);if(baseTimes.length!==postsPerDay)throw new Error("Smart Campaign: não foi possível distribuir todos os posts");
  for(let i=1;i<baseTimes.length;i++){const interval=baseTimes[i].minutes-baseTimes[i-1].minutes;if(interval<minIntervalMinutes)throw new Error(`Smart Campaign: intervalo de ${interval} minutos é menor que o mínimo configurado de ${minIntervalMinutes} minutos`);}
  const slots:SmartPublicationSlot[]=[];let dayIndex=0;let sequence=0;
  for(let currentDate=startDate;compareCalendarDates(currentDate,endDate)<=0;currentDate=addCalendarDays(startDate,++dayIndex)){
    for(let accountIndex=0;accountIndex<config.accounts.length;accountIndex++){
      const account=config.accounts[accountIndex];
      baseTimes.forEach((baseTime,dailyPosition)=>{
        // Stable seeded shuffle: every account walks all content exactly once,
        // while unique offsets avoid the same video in the same publishing wave.
        const position=dayIndex*postsPerDay+dailyPosition;
        const accountOffset=accountOffsets[accountIndex%accountOffsets.length];
        const contentIndex=(position+accountOffset)%shuffledContents.length;
        const content=shuffledContents[contentIndex];
        const finalMinutes=baseTime.minutes+accountIndex*staggerMinutes;
        slots.push({accountId:account.id,platform:account.platform,contentId:content.id,scheduledFor:saoPauloToIso(currentDate,finalMinutes),dayPeriod:baseTime.period,sequence:sequence++});
      });
    }
  }
  return slots.sort((a,b)=>new Date(a.scheduledFor).getTime()-new Date(b.scheduledFor).getTime());
}
export interface SmartOccupiedSlot { accountId:string; scheduledFor:string; }
export interface SmartConflictResolutionConfig { occupiedSlots:SmartOccupiedSlot[]; minIntervalMinutes:number; shiftStepMinutes?:number; maxAttempts?:number; startDate?:string; endDate?:string; dailyStartTime?:string; dailyEndTime?:string; }
export function resolveSmartCampaignConflicts<T extends SmartPublicationSlot>(slots:T[],config:SmartConflictResolutionConfig):T[] {
  const minIntervalMs=Math.max(1,config.minIntervalMinutes)*60_000;const shiftStepMs=Math.max(1,config.shiftStepMinutes??Math.min(15,Math.max(5,config.minIntervalMinutes)))*60_000;const maxAttempts=Math.max(1,config.maxAttempts??500);const occupiedByAccount=new Map<string,number[]>();
  const addOccupied=(accountId:string,scheduledFor:string)=>{const timestamp=new Date(scheduledFor).getTime();if(!Number.isFinite(timestamp))return;const list=occupiedByAccount.get(accountId)||[];list.push(timestamp);occupiedByAccount.set(accountId,list);};config.occupiedSlots.forEach(slot=>addOccupied(slot.accountId,slot.scheduledFor));
  const sortedSlots=[...slots].sort((a,b)=>new Date(a.scheduledFor).getTime()-new Date(b.scheduledFor).getTime());const resolved:T[]=[];
  for(const slot of sortedSlots){let candidate=new Date(slot.scheduledFor).getTime();if(!Number.isFinite(candidate))throw new Error("Smart Campaign: horário inválido durante resolução de conflitos");let attempts=0;while(attempts<maxAttempts){const occupied=occupiedByAccount.get(slot.accountId)||[];const hasConflict=occupied.some(existing=>Math.abs(candidate-existing)<minIntervalMs);if(!hasConflict)break;candidate+=shiftStepMs;attempts++;if(config.startDate&&config.endDate&&config.dailyStartTime&&config.dailyEndTime){const candidateDate=new Date(candidate);const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(candidateDate);const getPart=(type:string)=>parts.find(part=>part.type===type)?.value||"";const localDate=`${getPart("year")}-${getPart("month")}-${getPart("day")}`;const localTime=`${getPart("hour")}:${getPart("minute")}`;if(localTime>config.dailyEndTime){const current=parseDate(localDate);const next=addCalendarDays(current,1);const nextDate=`${String(next.year).padStart(4,"0")}-${String(next.month).padStart(2,"0")}-${String(next.day).padStart(2,"0")}`;if(nextDate>config.endDate)throw new Error(`Smart Campaign: agenda cheia para a conta ${slot.accountId} dentro do período configurado`);candidate=new Date(`${nextDate}T${config.dailyStartTime}:00-03:00`).getTime();}}}
    if(attempts>=maxAttempts)throw new Error(`Smart Campaign: não foi possível encontrar horário livre para a conta ${slot.accountId}`);const resolvedSlot={...slot,scheduledFor:new Date(candidate).toISOString()} as T;resolved.push(resolvedSlot);addOccupied(resolvedSlot.accountId,resolvedSlot.scheduledFor);
  }
  return resolved.sort((a,b)=>new Date(a.scheduledFor).getTime()-new Date(b.scheduledFor).getTime());
}
