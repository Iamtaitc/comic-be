// src/services/crawler/ApiRateDetector.js
const logger = require("../../utils/logger");
const { 
  REQUEST_DELAY, 
  MAX_DELAY, 
  SLOW_RESPONSE_THRESHOLD, 
  VERY_SLOW_RESPONSE_THRESHOLD,
  MAX_CONSECUTIVE_ERRORS,
  MAX_CONSECUTIVE_EMPTY_PAGES
} = require("./CrawlerConfig");

class ApiRateDetector {
  constructor(options = {}) {
    this.baseDelay = options.baseDelay || REQUEST_DELAY;
    this.maxDelay = options.maxDelay || MAX_DELAY;
    this.backoffMultiplier = options.backoffMultiplier || 1.6;
    this.successReduction = options.successReduction || 0.9;
    
    // Dynamic state
    this.currentState = {
      currentDelay: this.baseDelay,
      consecutiveErrors: 0,
      consecutiveEmptyPages: 0,
      avgResponseTime: 1000,
      isRateLimited: false,
      lastSuccessTime: Date.now()
    };
    
    // Response history for analysis
    this.responseHistory = [];
    this.maxHistorySize = 100;
    
    // Rate limit detection thresholds
    this.thresholds = {
      slowResponse: SLOW_RESPONSE_THRESHOLD,
      verySlowResponse: VERY_SLOW_RESPONSE_THRESHOLD,
      emptyPageLimit: MAX_CONSECUTIVE_EMPTY_PAGES,
      errorLimit: MAX_CONSECUTIVE_ERRORS
    };
    
    // Error pattern tracking
    this.errorPattern = {
      rateLimitErrors: 0,
      timeoutErrors: 0,
      connectionErrors: 0,
      totalErrors: 0,
      lastErrorTime: null
    };
  }

  /**
   * 🔍 Phân tích response để detect rate limiting
   */
  analyzeResponse(response, responseTime, url) {
    const analysis = {
      url,
      timestamp: Date.now(),
      responseTime,
      status: 'success',
      rateLimitDetected: false,
      recommendedAction: 'continue',
      confidence: 0,
      rateLimitInfo: null
    };

    // 1. Kiểm tra HTTP status codes
    if (response?.status && this.isRateLimitStatusCode(response.status)) {
      analysis.status = 'rate_limited';
      analysis.rateLimitDetected = true;
      analysis.confidence = 0.95;
      analysis.recommendedAction = 'backoff';
      logger.warn(`🚫 Rate limit detected: HTTP ${response.status} for ${url}`);
    }
    // 2. Kiểm tra response time thresholds
    else if (responseTime > this.thresholds.verySlowResponse) {
      analysis.status = 'very_slow';
      analysis.rateLimitDetected = true;
      analysis.confidence = 0.8;
      analysis.recommendedAction = 'slow_down';
      logger.warn(`🐌 Very slow response: ${responseTime}ms for ${url}`);
    }
    else if (responseTime > this.thresholds.slowResponse) {
      analysis.status = 'slow';
      analysis.rateLimitDetected = true;
      analysis.confidence = 0.5;
      analysis.recommendedAction = 'reduce_speed';
      logger.debug(`⚠️ Slow response: ${responseTime}ms for ${url}`);
    }
    // 3. Kiểm tra empty response patterns
    else if (this.isEmptyResponse(response)) {
      analysis.status = 'empty';
      this.currentState.consecutiveEmptyPages++;
      
      if (this.currentState.consecutiveEmptyPages >= this.thresholds.emptyPageLimit) {
        analysis.rateLimitDetected = true;
        analysis.confidence = 0.7;
        analysis.recommendedAction = 'check_api_health';
        logger.warn(`📭 ${this.currentState.consecutiveEmptyPages} consecutive empty pages detected`);
      }
    } else {
      // Reset empty page counter on successful response with data
      this.currentState.consecutiveEmptyPages = 0;
      this.currentState.lastSuccessTime = Date.now();
    }

    // 4. Kiểm tra rate limit headers (nếu có)
    if (response?.headers) {
      const rateLimitHeaders = this.checkRateLimitHeaders(response.headers);
      if (rateLimitHeaders.detected) {
        analysis.rateLimitDetected = true;
        analysis.confidence = Math.max(analysis.confidence, 0.9);
        analysis.rateLimitInfo = rateLimitHeaders;
        analysis.recommendedAction = rateLimitHeaders.action;
        logger.info(`📊 Rate limit headers detected:`, rateLimitHeaders);
      }
    }

    // 5. Kiểm tra patterns trong response body
    if (this.hasRateLimitContent(response)) {
      analysis.rateLimitDetected = true;
      analysis.confidence = Math.max(analysis.confidence, 0.8);
      analysis.recommendedAction = 'backoff';
      logger.warn(`🔍 Rate limit content detected in response body`);
    }

    // Update state và history
    this.updateHistory(analysis);
    this.updateCurrentState(analysis);

    return analysis;
  }

  /**
   * ❌ Phân tích error để detect rate limiting
   */
  analyzeError(error, responseTime, url) {
    const analysis = {
      url,
      timestamp: Date.now(),
      responseTime,
      status: 'error',
      error: error.message,
      rateLimitDetected: false,
      recommendedAction: 'retry',
      confidence: 0,
      errorType: this.classifyError(error)
    };

    this.currentState.consecutiveErrors++;
    this.errorPattern.totalErrors++;
    this.errorPattern.lastErrorTime = Date.now();

    // Classify và handle different error types
    switch (analysis.errorType) {
      case 'RATE_LIMIT':
        this.errorPattern.rateLimitErrors++;
        analysis.rateLimitDetected = true;
        analysis.confidence = 0.95;
        analysis.recommendedAction = 'backoff';
        logger.error(`🚫 Rate limit error: ${error.message}`);
        break;

      case 'TIMEOUT':
        this.errorPattern.timeoutErrors++;
        if (responseTime > 10000) {
          analysis.rateLimitDetected = true;
          analysis.confidence = 0.6;
          analysis.recommendedAction = 'slow_down';
        }
        logger.warn(`⏱️ Timeout error after ${responseTime}ms`);
        break;

      case 'CONNECTION_ERROR':
        this.errorPattern.connectionErrors++;
        analysis.rateLimitDetected = true;
        analysis.confidence = 0.4;
        analysis.recommendedAction = 'pause_and_retry';
        logger.error(`🔌 Connection error: ${error.message}`);
        break;

      default:
        analysis.recommendedAction = 'retry';
        logger.warn(`❓ Unknown error: ${error.message}`);
    }

    // Check consecutive errors pattern
    if (this.currentState.consecutiveErrors >= this.thresholds.errorLimit) {
      analysis.rateLimitDetected = true;
      analysis.confidence = Math.max(analysis.confidence, 0.8);
      analysis.recommendedAction = 'pause_and_retry';
      logger.error(`🔥 ${this.currentState.consecutiveErrors} consecutive errors - possible API blocking`);
    }

    this.updateHistory(analysis);
    this.updateCurrentState(analysis);

    return analysis;
  }

  /**
   * 📊 Kiểm tra rate limit headers
   */
  checkRateLimitHeaders(headers) {
    const result = { detected: false, action: 'continue' };
    
    // Common rate limit header patterns
    const rateLimitHeaders = [
      'x-ratelimit-remaining',
      'x-rate-limit-remaining', 
      'ratelimit-remaining',
      'x-ratelimit-limit',
      'x-rate-limit-limit',
      'retry-after',
      'x-retry-after'
    ];

    for (const header of rateLimitHeaders) {
      const value = headers[header] || headers[header.toLowerCase()];
      if (value !== undefined) {
        result.detected = true;
        result[header] = value;
        
        // Parse specific headers
        if (header.includes('remaining')) {
          const remaining = parseInt(value);
          if (!isNaN(remaining)) {
            result.remainingRequests = remaining;
            if (remaining < 10) {
              result.action = 'slow_down';
            } else if (remaining < 5) {
              result.action = 'backoff';
            }
          }
        }
        
        if (header.includes('retry-after')) {
          const retryAfter = parseInt(value);
          if (!isNaN(retryAfter)) {
            result.action = 'wait';
            result.retryAfter = retryAfter * 1000; // Convert to ms
          }
        }
      }
    }

    return result;
  }

  /**
   * 📭 Kiểm tra response rỗng
   */
  isEmptyResponse(response) {
    if (!response || !response.data) return true;
    
    const data = response.data;
    
    // Empty items array
    if (data.items && Array.isArray(data.items) && data.items.length === 0) {
      return true;
    }
    
    // Empty data object
    if (typeof data === 'object' && Object.keys(data).length === 0) {
      return true;
    }
    
    // Error status in response
    if (data.status === 'error' || data.status === 'fail') {
      return true;
    }

    // No data property
    if (!data.hasOwnProperty('items') && !data.hasOwnProperty('data')) {
      return true;
    }

    return false;
  }

  /**
   * 🔍 Check for rate limit content in response body
   */
  hasRateLimitContent(response) {
    if (!response || !response.data) return false;
    
    const content = JSON.stringify(response.data).toLowerCase();
    const rateLimitIndicators = [
      'rate limit',
      'too many requests', 
      'quota exceeded',
      'api limit',
      'throttled',
      'slow down'
    ];
    
    return rateLimitIndicators.some(indicator => content.includes(indicator));
  }

  /**
   * 🏷️ Classify error type
   */
  classifyError(error) {
    if (error.response?.status === 429) return 'RATE_LIMIT';
    if (error.response?.status === 503) return 'SERVICE_UNAVAILABLE';
    if (error.response?.status === 502) return 'BAD_GATEWAY';
    if (error.code === 'ECONNABORTED') return 'TIMEOUT';
    if (error.code === 'ENOTFOUND') return 'DNS_ERROR';
    if (error.code === 'ECONNREFUSED') return 'CONNECTION_ERROR';
    if (error.message?.toLowerCase().includes('timeout')) return 'TIMEOUT';
    if (error.message?.toLowerCase().includes('rate limit')) return 'RATE_LIMIT';
    return 'UNKNOWN';
  }

  /**
   * 🚦 Check if status code indicates rate limiting
   */
  isRateLimitStatusCode(statusCode) {
    return [429, 503, 502, 504, 509].includes(statusCode);
  }

  /**
   * 📈 Cập nhật history
   */
  updateHistory(analysis) {
    this.responseHistory.push(analysis);
    
    if (this.responseHistory.length > this.maxHistorySize) {
      this.responseHistory.shift();
    }
  }

  /**
   * 🔄 Cập nhật current state
   */
  updateCurrentState(analysis) {
    // Update average response time
    const recentResponses = this.responseHistory.slice(-20);
    if (recentResponses.length > 0) {
      const totalTime = recentResponses.reduce((sum, r) => sum + r.responseTime, 0);
      this.currentState.avgResponseTime = totalTime / recentResponses.length;
    }

    // Update rate limit state
    this.currentState.isRateLimited = analysis.rateLimitDetected;

    // Reset error counter on success
    if (analysis.status === 'success' && !analysis.rateLimitDetected) {
      this.currentState.consecutiveErrors = 0;
    }

    // Calculate recommended delay
    this.currentState.currentDelay = this.calculateRecommendedDelay(analysis);
  }

  /**
   * ⏱️ Tính toán delay được đề xuất
   */
  calculateRecommendedDelay(analysis) {
    let baseDelay = this.baseDelay;

    // Base multiplier dựa trên recommended action
    switch (analysis.recommendedAction) {
      case 'continue':
        return Math.max(baseDelay * 0.8, 800); // Faster when all good
        
      case 'reduce_speed':
        return baseDelay * 1.5;
        
      case 'slow_down':
        return baseDelay * 3;
        
      case 'backoff':
        return Math.min(baseDelay * 8, this.maxDelay);
        
      case 'pause_and_retry':
        return Math.min(baseDelay * 15, this.maxDelay);
        
      case 'wait':
        return analysis.rateLimitInfo?.retryAfter || Math.min(baseDelay * 10, this.maxDelay);
        
      case 'check_api_health':
        return baseDelay * 5;
        
      default:
        return baseDelay;
    }
  }

  /**
   * 🎯 Lấy delay hiện tại với additional factors
   */
  getCurrentDelay() {
    let delay = this.currentState.currentDelay;
    
    // Factor in consecutive errors
    if (this.currentState.consecutiveErrors > 0) {
      const errorMultiplier = Math.pow(1.4, Math.min(this.currentState.consecutiveErrors, 5));
      delay *= errorMultiplier;
    }
    
    // Factor in consecutive empty pages
    if (this.currentState.consecutiveEmptyPages > 0) {
      const emptyMultiplier = Math.pow(1.3, Math.min(this.currentState.consecutiveEmptyPages, 3));
      delay *= emptyMultiplier;
    }
    
    // Factor in average response time
    if (this.currentState.avgResponseTime > 3000) {
      delay *= 1.5;
    }
    
    // Add jitter to avoid thundering herd (±10%)
    const jitter = 0.9 + Math.random() * 0.2;
    delay *= jitter;

    // Ensure within bounds
    const finalDelay = Math.max(Math.min(delay, this.maxDelay), 500);
    
    return Math.round(finalDelay);
  }

  /**
   * 🔍 API Health Check
   */
  async checkApiHealth(baseUrl) {
    logger.info("🔍 Checking API health...");
    
    const startTime = Date.now();
    try {
      const axios = require('axios');
      const response = await axios.get(`${baseUrl}/the-loai`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'ComicCrawler/2.0 Health-Check'
        }
      });
      
      const responseTime = Date.now() - startTime;
      const isHealthy = response.status === 200 && responseTime < 5000;
      
      logger.info(`💗 API Health: ${isHealthy ? 'Good' : 'Poor'} (${responseTime}ms)`);
      
      return {
        healthy: isHealthy,
        responseTime,
        status: response.status,
        recommendedDelay: isHealthy ? this.baseDelay : this.baseDelay * 3
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`💔 API Health Check failed: ${error.message}`);
      
      return {
        healthy: false,
        responseTime,
        error: error.message,
        recommendedDelay: this.baseDelay * 5
      };
    }
  }

  /**
   * 📊 Lấy thống kê hiệu suất
   */
  getStats() {
    const recentTimeWindow = 5 * 60 * 1000; // 5 minutes
    const cutoffTime = Date.now() - recentTimeWindow;
    
    const recentHistory = this.responseHistory.filter(r => r.timestamp > cutoffTime);
    const recentErrors = recentHistory.filter(r => r.status === 'error').length;
    const recentRateLimits = recentHistory.filter(r => r.rateLimitDetected).length;
    
    return {
      currentState: {
        ...this.currentState,
        timeSinceLastSuccess: Date.now() - this.currentState.lastSuccessTime
      },
      recentMetrics: {
        totalRequests: recentHistory.length,
        errors: recentErrors,
        rateLimits: recentRateLimits,
        errorRate: recentHistory.length > 0 ? recentErrors / recentHistory.length : 0,
        rateLimitRate: recentHistory.length > 0 ? recentRateLimits / recentHistory.length : 0
      },
      errorPattern: this.errorPattern,
      performance: {
        avgResponseTime: Math.round(this.currentState.avgResponseTime),
        currentDelay: this.getCurrentDelay(),
        totalRequests: this.responseHistory.length
      },
      thresholds: this.thresholds
    };
  }

  /**
   * 🔄 Reset detector state
   */
  reset() {
    this.currentState = {
      currentDelay: this.baseDelay,
      consecutiveErrors: 0,
      consecutiveEmptyPages: 0,
      avgResponseTime: 1000,
      isRateLimited: false,
      lastSuccessTime: Date.now()
    };
    
    this.responseHistory = [];
    
    this.errorPattern = {
      rateLimitErrors: 0,
      timeoutErrors: 0,
      connectionErrors: 0,
      totalErrors: 0,
      lastErrorTime: null
    };
    
    logger.info("🔄 API Rate Detector reset to default state");
  }

  /**
   * ⚡ Quick health assessment
   */
  isHealthy() {
    const stats = this.getStats();
    
    // Consider unhealthy if:
    // - High recent error rate (>30%)
    // - Many consecutive errors (>3)
    // - Rate limited recently
    // - Very slow responses
    
    return (
      stats.recentMetrics.errorRate < 0.3 &&
      this.currentState.consecutiveErrors < 3 &&
      !this.currentState.isRateLimited &&
      this.currentState.avgResponseTime < 10000
    );
  }
}

module.exports = ApiRateDetector;