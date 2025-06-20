// src/services/crawler/CategoryProcessor.js
const logger = require("../../utils/logger");
const { Category } = require("../../models/index");
const CrawlerUtils = require("./CrawlerUtils");
const { API_BASE_URL } = require("./CrawlerConfig");

class CategoryProcessor {
  constructor(crawlerService) {
    this.crawlerService = crawlerService;
    this.processedCategories = 0;
    this.errors = 0;
  }

  /**
   * 📂 Enhanced category crawling with validation and error handling
   */
  async crawlCategories() {
    logger.info("📂 Starting enhanced category crawling...");

    try {
      const startTime = Date.now();
      const response = await this.fetchCategoriesWithRetry();
      const responseTime = Date.now() - startTime;

      if (this.isValidCategoryResponse(response)) {
        const categories = response.data.items;
        await this.processCategoriesBatch(categories);

        logger.info(
          `✅ Categories crawl completed: ${this.processedCategories} processed, ${this.errors} errors (${responseTime}ms)`
        );

        return {
          success: true,
          processed: this.processedCategories,
          errors: this.errors,
          duration: responseTime,
        };
      } else {
        throw new Error("Invalid category response format");
      }
    } catch (error) {
      this.errors++;
      this.crawlerService.stats.errors++;
      logger.error("❌ Category crawling failed:", error.message);

      return {
        success: false,
        error: error.message,
        processed: this.processedCategories,
        errors: this.errors,
      };
    }
  }

  /**
   * 🌐 Fetch categories with enhanced retry logic
   */
  async fetchCategoriesWithRetry() {
    const url = `${API_BASE_URL}/the-loai`;

    try {
      const response = await CrawlerUtils.fetchWithRetry(url, {
        timeout: 10000,
        maxRetries: 3,
      });

      this.crawlerService.stats.apiCallsMade++;
      return response;
    } catch (error) {
      logger.error(`❌ Failed to fetch categories from ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * ✅ Validate category response structure
   */
  isValidCategoryResponse(response) {
    return (
      response &&
      response.status === "success" &&
      response.data &&
      Array.isArray(response.data.items) &&
      response.data.items.length > 0
    );
  }

  /**
   * 📦 Process categories in batch with validation
   */
  async processCategoriesBatch(categories) {
    logger.info(`📦 Processing ${categories.length} categories in batch...`);

    const validCategories = [];
    const invalidCategories = [];

    // Validate each category first
    for (const category of categories) {
      const validation = this.validateCategoryData(category);
      if (validation.isValid) {
        validCategories.push(this.prepareCategoryDocument(category));
      } else {
        invalidCategories.push({
          category: category.name,
          errors: validation.errors,
        });
        logger.warn(
          `⚠️ Invalid category data for ${category.name}:`,
          validation.errors
        );
      }
    }

    if (invalidCategories.length > 0) {
      logger.warn(`⚠️ Found ${invalidCategories.length} invalid categories`);
    }

    if (validCategories.length === 0) {
      logger.warn("⚠️ No valid categories to process");
      return;
    }

    // Prepare bulk operations
    const bulkOps = validCategories.map((categoryDoc) => ({
      updateOne: {
        filter: { _id: categoryDoc._id },
        update: {
          $set: categoryDoc,
        },
        upsert: true,
      },
    }));

    try {
      const result = await Category.bulkWrite(bulkOps, {
        ordered: false, // Continue on duplicate errors
      });

      this.processedCategories = result.upsertedCount + result.modifiedCount;

      logger.info(
        `💾 Category batch: ${result.upsertedCount} new, ${result.modifiedCount} updated`
      );
    } catch (error) {
      if (error.writeErrors) {
        const duplicates = error.writeErrors.filter((e) => e.code === 11000);
        const successful = bulkOps.length - error.writeErrors.length;

        this.processedCategories = successful;
        this.errors = duplicates.length;

        logger.warn(
          `⚠️ Category batch: ${successful} processed, ${duplicates.length} duplicates handled`
        );
      } else {
        this.errors = bulkOps.length;
        logger.error("❌ Category batch write failed:", error.message);
        throw error;
      }
    }
  }

  /**
   * 🔍 Validate category data
   */
  validateCategoryData(category) {
    const errors = [];

    if (!category._id) {
      errors.push("Missing category _id");
    }

    if (!category.name || typeof category.name !== "string") {
      errors.push("Missing or invalid category name");
    }

    if (!category.slug || typeof category.slug !== "string") {
      errors.push("Missing or invalid category slug");
    }

    if (category.name && category.name.length > 100) {
      errors.push("Category name too long");
    }

    if (category.slug && category.slug.length > 100) {
      errors.push("Category slug too long");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 📋 Prepare category document for database
   */
  prepareCategoryDocument(category) {
    // Create a clean, standardized category document
    const categoryDoc = {
      _id: category._id,
      name: category.name.trim(),
      slug: category.slug.trim(),
      description: category.description
        ? category.description.trim().substring(0, 500)
        : "",
      isActive: true,
      deletedAt: null,
      // Additional metadata
      originalData: {
        source: "otruyenapi",
        lastUpdated: new Date(),
        apiVersion: "1.0",
      },
    };

    return CrawlerUtils.cleanObject(categoryDoc);
  }

  /**
   * 🔍 Get category by slug (utility method)
   */
  async getCategoryBySlug(slug) {
    try {
      return await Category.findOne({ slug, deletedAt: null }).lean();
    } catch (error) {
      logger.error(`❌ Error finding category by slug ${slug}:`, error.message);
      return null;
    }
  }

  /**
   * 📊 Get category statistics
   */
  async getCategoryStats() {
    try {
      const stats = await Category.aggregate([
        { $match: { deletedAt: null } },
        {
          $group: {
            _id: null,
            totalCategories: { $sum: 1 },
            activeCategories: {
              $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
            },
          },
        },
      ]);

      return stats[0] || { totalCategories: 0, activeCategories: 0 };
    } catch (error) {
      logger.error("❌ Error getting category stats:", error.message);
      return { totalCategories: 0, activeCategories: 0 };
    }
  }

  /**
   * 🧹 Cleanup inactive categories
   */
  async cleanupInactiveCategories() {
    try {
      // Mark categories as inactive if they haven't been updated in 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await Category.updateMany(
        {
          "originalData.lastUpdated": { $lt: thirtyDaysAgo },
          isActive: true,
          deletedAt: null,
        },
        {
          $set: { isActive: false },
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(`🧹 Marked ${result.modifiedCount} categories as inactive`);
      }

      return result.modifiedCount;
    } catch (error) {
      logger.error("❌ Error cleaning up inactive categories:", error.message);
      return 0;
    }
  }

  /**
   * 🔄 Refresh single category
   */
  async refreshCategory(categoryId) {
    try {
      logger.info(`🔄 Refreshing category: ${categoryId}`);

      // This would typically fetch from API, but since we don't have individual category endpoint,
      // we'll refresh all categories
      const result = await this.crawlCategories();

      if (result.success) {
        logger.info(
          `✅ Category ${categoryId} refreshed as part of full refresh`
        );
        return { success: true, message: "Category refreshed" };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error(
        `❌ Error refreshing category ${categoryId}:`,
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * 📝 Validate all existing categories
   */
  async validateExistingCategories() {
    try {
      logger.info("📝 Validating existing categories...");

      const categories = await Category.find({ deletedAt: null }).lean();
      const issues = [];

      for (const category of categories) {
        const validation = this.validateCategoryData(category);
        if (!validation.isValid) {
          issues.push({
            _id: category._id,
            name: category.name,
            errors: validation.errors,
          });
        }
      }

      if (issues.length > 0) {
        logger.warn(
          `⚠️ Found ${issues.length} categories with validation issues`
        );
        for (const issue of issues) {
          logger.warn(`  - ${issue.name}: ${issue.errors.join(", ")}`);
        }
      } else {
        logger.info("✅ All existing categories are valid");
      }

      return {
        total: categories.length,
        valid: categories.length - issues.length,
        issues,
      };
    } catch (error) {
      logger.error("❌ Error validating existing categories:", error.message);
      return { total: 0, valid: 0, issues: [] };
    }
  }

  /**
   * 📊 Get processing stats
   */
  getStats() {
    return {
      processedCategories: this.processedCategories,
      errors: this.errors,
      successRate:
        this.processedCategories > 0
          ? ((this.processedCategories - this.errors) /
              this.processedCategories) *
            100
          : 0,
    };
  }

  /**
   * 🔄 Reset processor stats
   */
  reset() {
    this.processedCategories = 0;
    this.errors = 0;
    logger.debug("🔄 CategoryProcessor stats reset");
  }
}

module.exports = CategoryProcessor;
