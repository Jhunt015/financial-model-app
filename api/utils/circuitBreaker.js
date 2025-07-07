// Circuit Breaker Pattern for API Reliability
// Prevents cascading failures and provides intelligent fallbacks

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.timeout = options.timeout || 30000; // 30 seconds
    this.retryTimeout = options.retryTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
    
    console.log(`🔧 Circuit breaker initialized: ${name}`);
  }

  async execute(operation, fallback = null) {
    console.log(`⚡ Circuit breaker [${this.name}] executing, state: ${this.state}`);
    
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        console.log(`🔄 Circuit breaker [${this.name}] attempting reset to HALF_OPEN`);
        this.state = 'HALF_OPEN';
      } else {
        console.log(`🚫 Circuit breaker [${this.name}] is OPEN, using fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker [${this.name}] is OPEN - service unavailable`);
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      // If we have a fallback and circuit is now OPEN, try fallback
      if (this.state === 'OPEN' && fallback) {
        console.log(`🔄 Circuit breaker [${this.name}] trying fallback after failure`);
        try {
          return await fallback();
        } catch (fallbackError) {
          console.error(`❌ Fallback also failed for [${this.name}]:`, fallbackError.message);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  async executeWithTimeout(operation) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.timeout}ms`));
      }, this.timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      console.log(`✅ Circuit breaker [${this.name}] success in HALF_OPEN, resetting to CLOSED`);
      this.state = 'CLOSED';
    }
    
    console.log(`✅ Circuit breaker [${this.name}] success, state: ${this.state}`);
  }

  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    console.log(`❌ Circuit breaker [${this.name}] failure ${this.failureCount}/${this.failureThreshold}: ${error.message}`);
    
    if (this.failureCount >= this.failureThreshold) {
      console.log(`🚫 Circuit breaker [${this.name}] OPENING due to failure threshold`);
      this.state = 'OPEN';
    }
  }

  shouldAttemptReset() {
    return Date.now() - this.lastFailureTime > this.retryTimeout;
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Exponential backoff utility
class ExponentialBackoff {
  constructor(options = {}) {
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.factor = options.factor || 2;
  }

  async execute(operation, context = 'operation') {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Retry attempt ${attempt + 1}/${this.maxRetries + 1} for ${context}`);
        const result = await operation();
        if (attempt > 0) {
          console.log(`✅ ${context} succeeded after ${attempt} retries`);
        }
        return result;
      } catch (error) {
        lastError = error;
        console.log(`❌ ${context} failed on attempt ${attempt + 1}: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          const delay = Math.min(this.baseDelay * Math.pow(this.factor, attempt), this.maxDelay);
          console.log(`⏱️  Waiting ${delay}ms before retry ${attempt + 2}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`💥 ${context} failed after ${this.maxRetries + 1} attempts`);
    throw lastError;
  }
}

// Global circuit breakers for different services
const circuitBreakers = {
  openai: new CircuitBreaker('OpenAI-API', {
    failureThreshold: 3,
    timeout: 60000, // 1 minute for AI calls
    retryTimeout: 120000 // 2 minutes before retry
  }),
  
  pdfExtraction: new CircuitBreaker('PDF-Extraction', {
    failureThreshold: 2,
    timeout: 30000, // 30 seconds for PDF processing
    retryTimeout: 60000 // 1 minute before retry
  }),
  
  visionAnalysis: new CircuitBreaker('Vision-Analysis', {
    failureThreshold: 3,
    timeout: 90000, // 1.5 minutes for vision analysis
    retryTimeout: 180000 // 3 minutes before retry
  })
};

// Convenience functions
const withCircuitBreaker = (breakerName, operation, fallback = null) => {
  const breaker = circuitBreakers[breakerName];
  if (!breaker) {
    throw new Error(`Circuit breaker '${breakerName}' not found`);
  }
  return breaker.execute(operation, fallback);
};

const withExponentialBackoff = (operation, options = {}) => {
  const backoff = new ExponentialBackoff(options);
  return backoff.execute(operation, options.context || 'operation');
};

// Health check endpoint
const getCircuitBreakerStatus = () => {
  return Object.fromEntries(
    Object.entries(circuitBreakers).map(([name, breaker]) => [
      name,
      breaker.getState()
    ])
  );
};

module.exports = {
  CircuitBreaker,
  ExponentialBackoff,
  circuitBreakers,
  withCircuitBreaker,
  withExponentialBackoff,
  getCircuitBreakerStatus
};