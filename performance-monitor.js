#!/usr/bin/env node

/**
 * Performance Monitor for Servio Restaurant Platform
 * Monitors system performance and provides optimization suggestions
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.results = {
      backend: {},
      frontend: {},
      database: {},
      system: {},
      recommendations: []
    };
  }

  // Monitor backend performance
  checkBackend() {
    console.log('🔍 Checking Backend Performance...');
    
    try {
      // Check if backend is running
      const backendStatus = execSync('lsof -ti:3002', { encoding: 'utf8', stdio: 'pipe' });
      this.results.backend.running = !!backendStatus.trim();
      
      if (this.results.backend.running) {
        console.log('✅ Backend is running on port 3002');
        
        // Test API response time
        const startTime = Date.now();
        try {
          execSync('curl -s http://localhost:3002/health', { timeout: 5000 });
          this.results.backend.responseTime = Date.now() - startTime;
          console.log(`⚡ Backend response time: ${this.results.backend.responseTime}ms`);
        } catch (error) {
          console.log('❌ Backend health check failed');
          this.results.backend.responseTime = null;
        }
      } else {
        console.log('❌ Backend is not running');
        this.results.recommendations.push('Start the backend server with: npm run dev --prefix backend');
      }
    } catch (error) {
      this.results.backend.running = false;
      console.log('❌ Backend is not running');
    }
  }

  // Monitor frontend performance
  checkFrontend() {
    console.log('🔍 Checking Frontend Performance...');
    
    try {
      const frontendStatus = execSync('lsof -ti:3000', { encoding: 'utf8', stdio: 'pipe' });
      this.results.frontend.running = !!frontendStatus.trim();
      
      if (this.results.frontend.running) {
        console.log('✅ Frontend is running on port 3000');
      } else {
        console.log('❌ Frontend is not running');
        this.results.recommendations.push('Start the frontend server with: npm run dev --prefix frontend');
      }
    } catch (error) {
      this.results.frontend.running = false;
      console.log('❌ Frontend is not running');
    }

    // Check bundle size (if built)
    const buildPath = path.join(__dirname, 'frontend', '.next');
    if (fs.existsSync(buildPath)) {
      console.log('📦 Build files found - checking sizes...');
      this.results.frontend.buildExists = true;
    }
  }

  // Monitor database performance
  checkDatabase() {
    console.log('🔍 Checking Database Performance...');

    // Database is external (Render) via DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    this.results.database.configured = !!databaseUrl;

    if (databaseUrl) {
      console.log('✅ DATABASE_URL is configured');
    } else {
      console.log('❌ DATABASE_URL is not set');
      this.results.recommendations.push('Set DATABASE_URL (Render Postgres) in your environment variables.');
    }
  }

  // Monitor system resources
  checkSystem() {
    console.log('🔍 Checking System Performance...');
    
    try {
      // Check memory usage
      const memInfo = execSync('ps aux | grep -E "(node|tsx)" | grep -v grep', { encoding: 'utf8', stdio: 'pipe' });
      const processes = memInfo.trim().split('\n').filter(line => line.length > 0);
      
      let totalMemory = 0;
      processes.forEach(process => {
        const parts = process.trim().split(/\s+/);
        if (parts.length > 5) {
          totalMemory += parseFloat(parts[5]) || 0;
        }
      });
      
      this.results.system.memoryUsage = (totalMemory / 1024).toFixed(2); // Convert to MB
      this.results.system.processCount = processes.length;
      
      console.log(`🧠 Total Node.js memory usage: ${this.results.system.memoryUsage}MB`);
      console.log(`🔄 Active Node processes: ${this.results.system.processCount}`);
      
      // Check for too many processes
      if (processes.length > 5) {
        this.results.recommendations.push(`Many Node processes running (${processes.length}). Consider killing unused processes.`);
      }
      
      // Check for high memory usage
      if (totalMemory > 2048) { // 2GB in MB
        this.results.recommendations.push('High memory usage detected. Consider restarting development servers.');
      }
      
    } catch (error) {
      console.log('⚠️  Could not check system resources');
    }
  }

  // Generate performance report
  generateReport() {
    console.log('\n📋 PERFORMANCE REPORT');
    console.log('='.repeat(50));
    
    if (this.results.backend.running && this.results.frontend.running) {
      console.log('✅ All services are running');
    } else {
      console.log('❌ Some services are not running');
    }
    
    if (this.results.backend.responseTime) {
      const responseScore = this.results.backend.responseTime < 100 ? 'Excellent' : 
                           this.results.backend.responseTime < 300 ? 'Good' : 
                           this.results.backend.responseTime < 1000 ? 'Fair' : 'Poor';
      console.log(`⚡ Backend Performance: ${responseScore} (${this.results.backend.responseTime}ms)`);
    }
    
    if (this.results.database.size) {
      console.log(`💾 Database: ${this.results.database.size}MB`);
    }
    
    if (this.results.system.memoryUsage) {
      console.log(`🧠 Memory Usage: ${this.results.system.memoryUsage}MB`);
    }
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    } else {
      console.log('\n🎉 No performance issues detected!');
    }
    
    console.log('\n🚀 QUICK START COMMANDS:');
    console.log('Backend:  npm run dev:fast --prefix backend');
    console.log('Frontend: npm run dev:fast --prefix frontend');
    console.log('Monitor:  node performance-monitor.js');
  }

  // Main execution
  async run() {
    console.log('🚀 Servio Performance Monitor\n');
    
    this.checkBackend();
    this.checkFrontend();
    this.checkDatabase();
    this.checkSystem();
    this.generateReport();
    
    return this.results;
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.run().catch(console.error);
}

module.exports = PerformanceMonitor;