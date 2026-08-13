import requests
import os
import json

def test_claim():
    url = "https://kdbgfgnopqqnzmvxvtje.supabase.co/functions/v1/render-bridge"
    secret = "e1af0567091f2616e47aa1c67b574e2f08faf3ed3bcf5fe45bb612baa52b6bb8"
    
    headers = {
        "x-render-worker-secret": secret,
        "Content-Type": "application/json"
    }
    
    payload = {"action": "claim"}
    
    print(f"Testing URL: {url}")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"HTTP STATUS: {response.status_code}")
        print(f"RESPONSE BODY: {response.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_claim()
