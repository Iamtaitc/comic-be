const mongoose = require("mongoose");

const User = require("./User.mongoose");
const Story = require("./Story.mongoose");
const Comment = require("./Comment.mongoose");
const Like = require("./Like.mongoose");
const Report = require("./Report.mongoose");
const Notification = require("./Notification.mongoose");
const ViewCounter = require("./ViewCounter.mongoose");
const Rating = require("./Rating.mongoose");
const Setting = require("./Setting.mongoose");
const History = require("./History.mongoose");
const CrawlerLog = require("./CrawlerLog.mogoose");
const Chapter = require("./Chapter.mongoose");
const Category = require("./Category.mongoose");
const Bookmark = require("./Bookmark.mongoose");

module.exports = {
  User,
  Story,
  Comment,
  Like,
  Report,
  Notification,
  Rating,
  Setting,
  History,
  CrawlerLog,
  Chapter,
  Category,
  Bookmark,
  ViewCounter,
};
