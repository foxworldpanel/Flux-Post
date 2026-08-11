import { supabase } from "@/integrations/supabase/client";

export type AssetType = 'music' | 'video' | 'photo' | 'render';

export interface StoragePathOptions {
  userId: string;
  assetType: AssetType;
  extension: string;
  artistId?: string;
}

/**
 * Normaliza e gera um caminho de storage seguro para evitar erros de "Invalid key"
 * e garantir organização por usuário.
 */
export const storageService = {
  generateSafePath(options: StoragePathOptions): string {
    const { userId, assetType, extension, artistId } = options;
    const uuid = crypto.randomUUID();
    const cleanExt = extension.toLowerCase().replace(/^\./, '');
    
    let path = `${userId}/${assetType}/`;
    if (artistId) {
      path += `${artistId}/`;
    }
    path += `${uuid}.${cleanExt}`;
    
    return path;
  },

  /**
   * Extrai a extensão de um arquivo de forma segura.
   */
  getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  },

  /**
   * Verifica se o arquivo tem uma extensão suportada.
   */
  isSupportedExtension(extension: string, supported: string[]): boolean {
    const cleanExt = extension.toLowerCase().replace(/^\./, '');
    return supported.includes(cleanExt);
  },

  /**
   * Remove um arquivo do storage se algo falhar no fluxo do banco de dados (Rollback).
   */
  async cleanup(bucket: string, path: string) {
    console.log(`[STORAGE CLEANUP] Removendo arquivo órfão: ${bucket}/${path}`);
    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) console.error("[STORAGE CLEANUP] Erro ao remover:", error);
    } catch (e) {
      console.error("[STORAGE CLEANUP] Exceção:", e);
    }
  }
};
