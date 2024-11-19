

const log = require("loglevel");



const prefix = require("loglevel-plugin-prefix");
const chalk = require("chalk");





const DEFAULT_LOG_LEVEL = "DEBUG";


const COLORS = {
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red,
};

function _configureLogPrefix(theLog) {
  prefix.apply(theLog, {
    template: "[%t] %l (%n):",
    levelFormatter(level) {
      const levelUC = level.toUpperCase();
      return `${COLORS[levelUC](levelUC)}`;
    },
    nameFormatter(name) {
      const moduleName = name ? name : "global";
      return `${chalk.gray(`${moduleName}`)}`;
    },
    timestampFormatter(date) {
      return `${chalk.gray(`${date.toISOString()}`)}`;
    },
  });

  theLog.setLevel(DEFAULT_LOG_LEVEL);
}








exports.getLog = (logName = "") => {
  if (logName) {
    const theLog = log.getLogger(logName);
    _configureLogPrefix(theLog);
    return theLog;
  }

  return log;
};

prefix.reg(log);
_configureLogPrefix(log);
