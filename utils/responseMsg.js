const { getTranslation } = require('./translations');

class MessageProvider {
  constructor() {
    this.languageType = 'EN'; 
  }

  setLanguage(languageType) {
    this.languageType = languageType || 'EN';
    return true;
  }
  getLanguage() {
    return this.languageType || 'EN';
  }

  getMessage(category, key) {
    return getTranslation(this.languageType, category, key);
  }
}

const messageProvider = new MessageProvider();

const createProxy = (category) => {
  return new Proxy({}, {
    get: (target, key) => {
      return messageProvider.getMessage(category, key);
    }
  });
};

const ADMIN = createProxy('ADMIN');
const EMAILTEMPLATE = createProxy('EMAILTEMPLATE');
const ERROR = createProxy('ERROR');
const SUCCESS = createProxy('SUCCESS');
const AUTH = createProxy('AUTH');
const USER = createProxy('USER');
const CONTENT = createProxy('CONTENT');
const LEAGUE = createProxy('LEAGUE');
const LANGUAGE = createProxy('LANGUAGE');
const FAQ = createProxy('FAQ');
const BANNER = createProxy('BANNER');
const SPORTMONKS = createProxy("SPORTMONKS")
const CONTEST = createProxy('CONTEST');
const WALLET = createProxy('WALLET');
const NOTIFICATIONTEMPLATE = createProxy('NOTIFICATIONTEMPLATE');
const NOTIFICATION = createProxy('NOTIFICATION');
const BOOSTERS = createProxy('BOOSTERS');
const PLAYER = createProxy('PLAYER');
const FANTASYTTEAM = createProxy('FANTASYTTEAM');
const MATCH = createProxy('MATCH');
const TOURNAMENT = createProxy('TOURNAMENT');
const APAY = createProxy('APAY');
const SUPPORT = createProxy("SUPPORT")

module.exports = {
  EMAILTEMPLATE,
  WALLET,
  BANNER,
  PLAYER,
  ADMIN,
  ERROR,
  SUCCESS,
  FANTASYTTEAM,
  AUTH,
  USER,
  CONTENT,
  LANGUAGE,
  FAQ,
  LEAGUE,
  TOURNAMENT,
  SUPPORT,
  APAY,
  MATCH,
  CONTEST,
  BOOSTERS,
  NOTIFICATIONTEMPLATE,
  SPORTMONKS,
  NOTIFICATION,
   setLanguage: (languageType) => messageProvider.setLanguage(languageType),
   getLanguage: () => messageProvider.getLanguage(),
};