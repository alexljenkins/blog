import os
import requests

NOTION_API_KEY = os.getenv("NOTION_API_KEY")

def notion_api_call(method, relative_path, body, reason):
    response = requests.request(
        method = method,
        json = body,
        url = f"https://api.notion.com/v1/{relative_path}",
        headers = {
            "Authorization": f"Bearer {NOTION_API_KEY}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
        }
    )
    response.raise_for_status()
   
    return response.json()
