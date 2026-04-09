# Deploy GitWhy Server to AWS EC2

## Prerequisites
- EC2 instance running (Ubuntu 20.04+ recommended)
- SSH access to your EC2 instance
- Domain name (optional, but recommended)

## Step 1: Connect to EC2

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

## Step 2: Install Node.js

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

## Step 3: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

## Step 4: Clone/Upload Your Server Code

**Option A: Using Git**
```bash
cd ~
git clone https://github.com/yourusername/gitwhy.git
cd gitwhy/server
```

**Option B: Upload via SCP (from your local machine)**
```bash
# On your local machine
cd /d/GitWhy
scp -i your-key.pem -r server ubuntu@your-ec2-ip:~/gitwhy-server
```

## Step 5: Install Dependencies

```bash
cd ~/gitwhy-server  # or ~/gitwhy/server
npm install
```

## Step 6: Create Environment File

```bash
nano .env
```

Add:
```
XAI_API_KEY=your_grok_api_key
VOYAGE_API_KEY=your_voyage_api_key
PORT=3000
NODE_ENV=production
```

Save: `Ctrl+X`, `Y`, `Enter`

## Step 7: Start Server with PM2

```bash
pm2 start index.js --name gitwhy-api
pm2 save
pm2 startup
```

Copy and run the command PM2 outputs.

## Step 8: Configure Firewall

```bash
# Allow port 3000
sudo ufw allow 3000
sudo ufw allow 22  # SSH
sudo ufw allow 80  # HTTP
sudo ufw allow 443 # HTTPS
sudo ufw enable
```

## Step 9: Test Server

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","service":"GitWhy API"}
```

From your local machine:
```bash
curl http://your-ec2-ip:3000/health
```

## Step 10: Setup Nginx (Reverse Proxy)

```bash
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/gitwhy
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your EC2 IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/gitwhy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 11: Setup SSL (Optional but Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Step 12: Update Client Code

Update `src/index.js` with your EC2 URL:

```javascript
if (!process.env.GITWHY_API_URL) {
  process.env.GITWHY_API_URL = 'http://your-ec2-ip';
  // or 'https://your-domain.com' if using SSL
}
```

## Useful PM2 Commands

```bash
# View logs
pm2 logs gitwhy-api

# Restart server
pm2 restart gitwhy-api

# Stop server
pm2 stop gitwhy-api

# Monitor
pm2 monit

# List all processes
pm2 list
```

## Auto-restart on Reboot

PM2 will automatically restart your server if EC2 reboots (already configured with `pm2 startup`).

## Update Server Code

```bash
cd ~/gitwhy-server
git pull  # if using git
npm install
pm2 restart gitwhy-api
```

## Security Checklist

- ✅ Use environment variables for API keys
- ✅ Enable UFW firewall
- ✅ Use SSL/HTTPS
- ✅ Keep Node.js updated
- ✅ Use PM2 for process management
- ✅ Regular backups

## Monitoring

Check server status:
```bash
pm2 status
pm2 logs --lines 50
```

Check Nginx:
```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

**Server not starting:**
```bash
pm2 logs gitwhy-api --err
```

**Port already in use:**
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

**Nginx errors:**
```bash
sudo nginx -t
sudo systemctl status nginx
```

## Cost Estimate

- EC2 t2.micro (free tier): $0/month for 1 year
- After free tier: ~$8-10/month
- Domain (optional): ~$12/year

## Your Server URL

After setup, your API will be available at:
- Without domain: `http://your-ec2-ip`
- With domain: `https://your-domain.com`

Update this in your client's `src/index.js`!
