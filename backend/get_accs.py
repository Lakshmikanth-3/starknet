import urllib.request
import json
import sys

def fetch(endpoint):
    url = f"http://127.0.0.1:5060{endpoint}"
    print(f"Trying {url}...")
    try:
        with urllib.request.urlopen(url) as response:
            return response.read().decode()
    except Exception as e:
        return f"Error: {e}"

def main():
    endpoints = ["/predeployed_accounts", "/predeployed-accounts", "/accounts", "/config", "/version"]
    for e in endpoints:
        res = fetch(e)
        if "Error" not in res:
            print(f"Success on {e}:")
            print(res)
            # break  # Keep going for config/version if needed
        else:
             print(res)

if __name__ == "__main__":
    main()
