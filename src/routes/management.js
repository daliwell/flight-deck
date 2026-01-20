const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Simple authentication for management endpoints
const MANAGEMENT_TOKEN = process.env.MANAGEMENT_TOKEN || 'semantic-chunker-management-2024';

function requireManagementAuth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
  
  if (token !== MANAGEMENT_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Update endpoint that downloads and applies configuration changes
router.post('/update-config', requireManagementAuth, async (req, res) => {
  try {
    console.log('Received configuration update request');
    
    // Download and apply the remote update script
    const scriptUrl = req.body.scriptUrl || 'https://semantic-chunker-remote-update-1760289889.s3.eu-west-1.amazonaws.com/remote-update.sh?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIASGWZNANKILT5XZES%2F20251012%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251012T172458Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=5cf0abf56f57b7d72808edbd021d197370e913dd54883914b15e5dcfe5cd7503';
    
    const updateCommand = `
      cd /tmp && 
      curl -L -o semantic-update.sh "${scriptUrl}" && 
      chmod +x semantic-update.sh && 
      sudo ./semantic-update.sh > update.log 2>&1 &
    `;
    
    exec(updateCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Update execution error:', error);
        return res.status(500).json({ 
          success: false, 
          error: error.message,
          stdout: stdout,
          stderr: stderr
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Update process started', 
        stdout: stdout 
      });
    });
    
  } catch (error) {
    console.error('Configuration update error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Status endpoint to check update progress
router.get('/update-status', requireManagementAuth, (req, res) => {
  const logPath = '/tmp/update.log';
  
  if (fs.existsSync(logPath)) {
    const logContent = fs.readFileSync(logPath, 'utf8');
    res.json({
      success: true,
      logExists: true,
      log: logContent
    });
  } else {
    res.json({
      success: true,
      logExists: false,
      message: 'No update log found'
    });
  }
});

// Configuration endpoint to test Parameter Store access
router.get('/test-parameter-store', requireManagementAuth, async (req, res) => {
  try {
    const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
    
    const client = new SSMClient({ region: 'eu-west-1' });
    
    const command = new GetParameterCommand({
      Name: '/semantic-chunker/mongodb-uri',
      WithDecryption: true
    });
    
    const result = await client.send(command);
    
    res.json({
      success: true,
      parameterExists: true,
      parameterName: result.Parameter.Name,
      hasValue: !!result.Parameter.Value
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      awsSdkAvailable: false
    });
  }
});

// Restart application endpoint
router.post('/restart', requireManagementAuth, (req, res) => {
  exec('pm2 restart semantic-chunker', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    res.json({
      success: true,
      message: 'Application restart initiated',
      output: stdout
    });
  });
});

module.exports = router;