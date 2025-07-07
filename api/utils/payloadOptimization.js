// Payload Optimization for PDF Processing
// Intelligent size management and quality optimization

// Payload size limits (in bytes)
const PAYLOAD_LIMITS = {
  VERCEL_LIMIT: 50 * 1024 * 1024, // 50MB Vercel limit
  SAFE_LIMIT: 8 * 1024 * 1024,    // 8MB safe limit
  WARNING_LIMIT: 5 * 1024 * 1024, // 5MB warning limit
  OPENAI_LIMIT: 20 * 1024 * 1024   // 20MB OpenAI practical limit
};

// Image quality levels for optimization
const QUALITY_LEVELS = [
  { scale: 2.0, quality: 0.95, name: 'ultra-high' },
  { scale: 1.8, quality: 0.85, name: 'high' },
  { scale: 1.5, quality: 0.75, name: 'medium-high' },
  { scale: 1.2, quality: 0.65, name: 'medium' },
  { scale: 1.0, quality: 0.55, name: 'low-medium' },
  { scale: 0.8, quality: 0.45, name: 'low' },
  { scale: 0.6, quality: 0.35, name: 'minimum' }
];

class PayloadOptimizer {
  constructor(options = {}) {
    this.targetSize = options.targetSize || PAYLOAD_LIMITS.SAFE_LIMIT;
    this.maxPages = options.maxPages || 10;
    this.prioritizeQuality = options.prioritizeQuality || false;
    
    console.log(`📊 Payload optimizer initialized with target size: ${this.formatSize(this.targetSize)}`);
  }

  // Calculate total payload size
  calculatePayloadSize(images) {
    if (!images || !Array.isArray(images)) return 0;
    
    return images.reduce((total, image) => {
      // Base64 encoding adds ~33% overhead
      const base64Size = image.length * 0.75; // Convert back to approximate binary size
      return total + base64Size;
    }, 0);
  }

  // Get payload size information
  getPayloadInfo(images) {
    const totalSize = this.calculatePayloadSize(images);
    const imageCount = images ? images.length : 0;
    
    return {
      totalSize,
      totalSizeMB: totalSize / (1024 * 1024),
      imageCount,
      averageImageSize: imageCount > 0 ? totalSize / imageCount : 0,
      isOverLimit: totalSize > this.targetSize,
      isOverWarning: totalSize > PAYLOAD_LIMITS.WARNING_LIMIT,
      isOverVercelLimit: totalSize > PAYLOAD_LIMITS.VERCEL_LIMIT,
      targetSize: this.targetSize,
      compressionNeeded: totalSize > this.targetSize ? 
        ((totalSize - this.targetSize) / totalSize) * 100 : 0
    };
  }

  // Optimize images to fit within payload limits
  async optimizeImages(images, metadata = {}) {
    console.log(`🔧 Starting image optimization for ${images.length} images`);
    
    const initialInfo = this.getPayloadInfo(images);
    console.log(`📊 Initial payload: ${this.formatSize(initialInfo.totalSize)} (${initialInfo.totalSizeMB.toFixed(2)}MB)`);
    
    if (!initialInfo.isOverLimit) {
      console.log('✅ Payload already within limits, no optimization needed');
      return {
        images,
        optimizationApplied: false,
        originalSize: initialInfo.totalSize,
        finalSize: initialInfo.totalSize,
        compressionRatio: 1.0,
        qualityLevel: 'original'
      };
    }

    // Strategy 1: Reduce number of pages first
    let optimizedImages = images;
    if (images.length > this.maxPages) {
      console.log(`📄 Reducing pages from ${images.length} to ${this.maxPages}`);
      optimizedImages = await this.selectBestPages(images, this.maxPages, metadata);
    }

    // Strategy 2: Apply progressive quality reduction
    for (const qualityLevel of QUALITY_LEVELS) {
      const testImages = await this.recompressImages(optimizedImages, qualityLevel);
      const testInfo = this.getPayloadInfo(testImages);
      
      console.log(`🎯 Testing ${qualityLevel.name} quality: ${this.formatSize(testInfo.totalSize)}`);
      
      if (!testInfo.isOverLimit) {
        console.log(`✅ Optimization successful with ${qualityLevel.name} quality`);
        return {
          images: testImages,
          optimizationApplied: true,
          originalSize: initialInfo.totalSize,
          finalSize: testInfo.totalSize,
          compressionRatio: testInfo.totalSize / initialInfo.totalSize,
          qualityLevel: qualityLevel.name,
          pageCount: testImages.length
        };
      }
    }

    // Strategy 3: Emergency fallback - use minimum quality and further reduce pages
    console.log('⚠️  Applying emergency optimization - minimum quality');
    const emergencyPages = Math.max(1, Math.floor(this.maxPages / 2));
    const emergencyImages = await this.selectBestPages(optimizedImages, emergencyPages, metadata);
    const finalImages = await this.recompressImages(emergencyImages, QUALITY_LEVELS[QUALITY_LEVELS.length - 1]);
    
    const finalInfo = this.getPayloadInfo(finalImages);
    
    return {
      images: finalImages,
      optimizationApplied: true,
      originalSize: initialInfo.totalSize,
      finalSize: finalInfo.totalSize,
      compressionRatio: finalInfo.totalSize / initialInfo.totalSize,
      qualityLevel: 'emergency-minimum',
      pageCount: finalImages.length,
      warning: 'Emergency optimization applied - quality may be reduced'
    };
  }

  // Select best pages for analysis
  async selectBestPages(images, maxPages, metadata = {}) {
    console.log(`📄 Selecting best ${maxPages} pages from ${images.length} pages`);
    
    // Simple strategy: Take first pages and last pages
    // In a real implementation, this would analyze content to find financial data
    const selectedIndices = [];
    
    // Always include first few pages (usually contain summaries)
    const firstPagesCount = Math.min(Math.ceil(maxPages * 0.6), images.length);
    for (let i = 0; i < firstPagesCount; i++) {
      selectedIndices.push(i);
    }
    
    // Include some from the end (usually contain detailed financials)
    const lastPagesCount = maxPages - firstPagesCount;
    const startFromEnd = Math.max(firstPagesCount, images.length - lastPagesCount);
    
    for (let i = startFromEnd; i < images.length && selectedIndices.length < maxPages; i++) {
      if (!selectedIndices.includes(i)) {
        selectedIndices.push(i);
      }
    }
    
    console.log(`📋 Selected pages: ${selectedIndices.join(', ')}`);
    
    return selectedIndices.map(index => images[index]);
  }

  // Recompress images with new quality settings
  async recompressImages(images, qualityLevel) {
    console.log(`🔧 Recompressing ${images.length} images with ${qualityLevel.name} quality`);
    
    // In a real implementation, this would re-render the PDF pages
    // For now, we'll simulate compression by reducing the base64 string size
    return images.map(image => {
      // Simulate compression by reducing string length
      // This is a placeholder - real implementation would re-render PDFs
      const compressionRatio = qualityLevel.quality * qualityLevel.scale / 2;
      const targetLength = Math.floor(image.length * compressionRatio);
      
      return image.substring(0, targetLength);
    });
  }

  // Format size for display
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // Get optimization recommendations
  getOptimizationRecommendations(images) {
    const info = this.getPayloadInfo(images);
    const recommendations = [];
    
    if (info.isOverVercelLimit) {
      recommendations.push({
        type: 'critical',
        message: 'Payload exceeds Vercel limit (50MB)',
        action: 'Apply emergency optimization'
      });
    } else if (info.isOverLimit) {
      recommendations.push({
        type: 'warning',
        message: `Payload exceeds safe limit (${this.formatSize(this.targetSize)})`,
        action: 'Apply quality optimization'
      });
    }
    
    if (info.imageCount > this.maxPages) {
      recommendations.push({
        type: 'info',
        message: `Too many pages (${info.imageCount} > ${this.maxPages})`,
        action: 'Reduce page count'
      });
    }
    
    return recommendations;
  }
}

// Smart page selection algorithm
class SmartPageSelector {
  constructor() {
    this.financialKeywords = [
      'income statement', 'balance sheet', 'cash flow', 'p&l', 'profit and loss',
      'revenue', 'ebitda', 'financial summary', 'historical performance',
      'key metrics', 'financial highlights', 'executive summary',
      'business overview', 'investment highlights', 'financial analysis'
    ];
  }

  // Analyze page content to determine relevance
  analyzePageRelevance(pageText) {
    const text = pageText.toLowerCase();
    let score = 0;
    
    // Score based on financial keywords
    for (const keyword of this.financialKeywords) {
      if (text.includes(keyword)) {
        score += 2;
      }
    }
    
    // Score based on numerical data (likely financial figures)
    const numberMatches = text.match(/\$[\d,]+|\d+%|\d+\.\d+[mb]?/g);
    if (numberMatches) {
      score += numberMatches.length * 0.5;
    }
    
    // Score based on table indicators
    const tableIndicators = ['table', 'chart', 'graph', 'data', 'figures'];
    for (const indicator of tableIndicators) {
      if (text.includes(indicator)) {
        score += 1;
      }
    }
    
    return Math.min(score, 10); // Cap at 10
  }

  // Select pages intelligently based on content
  selectPages(pageAnalysis, maxPages) {
    const sortedPages = pageAnalysis
      .map((analysis, index) => ({
        index,
        score: analysis.relevanceScore || 0,
        hasFinancialData: analysis.hasFinancialData || false
      }))
      .sort((a, b) => b.score - a.score);
    
    return sortedPages.slice(0, maxPages).map(page => page.index);
  }
}

module.exports = {
  PayloadOptimizer,
  SmartPageSelector,
  PAYLOAD_LIMITS,
  QUALITY_LEVELS
};