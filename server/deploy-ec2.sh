#!/bin/bash
# Quick EC2 deployment script
# Run this ON your EC2 instance

set -e

echo "🚀 GitWhy Server Deployment"
echo "=============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env template..."
    cat > .env << EOF
XAI_API_KEY=your_grok_api_key_here
VOYAGE_API_KEY=your_voyage_api_key_here
PORT=3000
NODE_ENV=production
EOF
    echo "❌ Please edit .env file with your API keys and run this script again"
    exit 1
fi

# Stop existing process if running
pm2 stop gitwhy-api 2>/dev/null || true
pm2 delete gitwhy-api 2>/dev/null || true

# Start server
echo "🚀 Starting server..."
pm2 start index.js --name gitwhy-api
pm2 save

# Setup startup script
echo "⚙️  Configuring auto-start..."
pm2 startup | tail -n 1 | bash

# Test server
echo "🧪 Testing server..."
sleep 2
curl -s http://localhost:3000/health || echo "⚠️  Server health check failed"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Server status:"
pm2 status

echo ""
echo "📝 Useful commands:"
echo "  pm2 logs gitwhy-api    - View logs"
echo "  pm2 restart gitwhy-api - Restart server"
echo "  pm2 monit              - Monitor server"
echo ""
echo "🌐 Your server is running at:"
echo "  http://$(curl -s ifconfig.me):3000"
