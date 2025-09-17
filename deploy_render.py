#!/usr/bin/env python3
import json
import requests
import sys

# Configuration
RENDER_API_KEY = "rnd_HrUPmuClpea4qQYltm9hs8YfWEgw"
GEE_CREDS_PATH = r"C:\Users\Dhenenjay\Downloads\axion-orbital-46448075249c.json"

print("🚀 Starting Render Deployment Process")
print("=" * 40)

# Read GEE credentials
try:
    with open(GEE_CREDS_PATH, 'r') as f:
        gee_json = f.read()
    print("✓ GEE credentials loaded")
except Exception as e:
    print(f"✗ Error loading GEE credentials: {e}")
    sys.exit(1)

# Headers for API requests
headers = {
    "Authorization": f"Bearer {RENDER_API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

# Service configuration
service_config = {
    "type": "web_service",
    "name": "axion-planetary-mcp",
    "ownerId": "tea-csp8oq3gbbvc73a8vaag",
    "repo": "https://github.com/Dhenenjay/axion-planetary-mcp",
    "autoDeploy": "yes",
    "branch": "master",
    "envVars": [
        {
            "key": "GOOGLE_APPLICATION_CREDENTIALS_JSON",
            "value": gee_json
        },
        {
            "key": "NODE_ENV",
            "value": "production"
        },
        {
            "key": "ANALYTICS_ENABLED",
            "value": "true"
        },
        {
            "key": "CORS_ORIGIN",
            "value": "*"
        },
        {
            "key": "PORT",
            "value": "10000"
        }
    ],
    "serviceDetails": {
        "env": "node",
        "region": "oregon",
        "plan": "starter",
        "buildCommand": "npm ci --production=false && npm run build:next",
        "startCommand": "npm run start:prod",
        "healthCheckPath": "/api/health",
        "envSpecificDetails": {
            "buildCommand": "npm ci --production=false && npm run build:next",
            "startCommand": "npm run start:prod"
        }
    }
}

print("\n📝 Creating new service on Render...")

# Create the service
try:
    response = requests.post(
        "https://api.render.com/v1/services",
        headers=headers,
        json=service_config,
        timeout=30
    )
    
    if response.status_code == 201:
        result = response.json()
        service_id = result.get('service', {}).get('id', 'unknown')
        service_url = f"https://axion-planetary-mcp.onrender.com"
        
        print(f"✅ Service created successfully!")
        print(f"   Service ID: {service_id}")
        print(f"   Dashboard: https://dashboard.render.com/web/{service_id}")
        print(f"   URL: {service_url}")
        print("\n⏱️  Deployment will take 10-15 minutes")
        print("   Monitor progress in the Render dashboard")
        
    elif response.status_code == 409:
        print("⚠️  Service already exists")
        print("   Please check: https://dashboard.render.com")
        
    else:
        print(f"❌ Error creating service: {response.status_code}")
        print(f"   Response: {response.text}")
        print("\n📋 Manual Setup Instructions:")
        print("   1. Go to: https://dashboard.render.com/create/web")
        print("   2. Connect repo: https://github.com/Dhenenjay/axion-planetary-mcp")
        print("   3. Settings:")
        print("      - Name: axion-planetary-mcp")
        print("      - Branch: master")
        print("      - Build: npm install && npm run build:next")
        print("      - Start: npm run start:prod")
        print("      - Add environment variables from above")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nPlease deploy manually via Render Dashboard")

print("\n" + "=" * 40)
print("✨ Deployment script completed!")
print("\n📍 Service URL: https://axion-planetary-mcp.onrender.com")
print("📊 Dashboard: https://dashboard.render.com")