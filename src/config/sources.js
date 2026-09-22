/*
 * Single place to see and change which sources the pipeline collects
 * from. Previously this array lived inline inside src/index.js,
 * mixed in with the pipeline's own logic; pulling it out here means
 * adding or removing a source never requires touching the pipeline
 * itself, and this file can be read on its own to answer "what does
 * this bot actually scrape".
 */

const { getTalantoJobs } = require("../parsers/talanto");
const { getTelegramWebJobs } = require("../parsers/telegramWeb");
const { getHabrCareerJobs } = require("../parsers/habrCareer");
const { getGeekJobJobs } = require("../parsers/geekjob");
const { getItaJobs } = require("../parsers/itaJobs");
const { getRemoteOkJobs } = require("../parsers/remoteOk");
const { getWellfoundJobs } = require("../parsers/wellfound");
const { getWorkingNomadsJobs } = require("../parsers/workingNomads");
const { getMinistryOfTestingJobs } = require("../parsers/ministryOfTesting");
const { getCompanyBoardJobs } = require("../parsers/companyBoards");

// Order is just display/run order, not priority.
const SOURCES = [
    { name: "Talanto", parser: getTalantoJobs },
    { name: "Telegram", parser: getTelegramWebJobs },
    { name: "Habr Career", parser: getHabrCareerJobs },
    { name: "GeekJob", parser: getGeekJobJobs },
    { name: "ITA Jobs", parser: getItaJobs },
    { name: "Remote OK", parser: getRemoteOkJobs },
    { name: "Wellfound", parser: getWellfoundJobs },
    { name: "Working Nomads", parser: getWorkingNomadsJobs },
    { name: "Ministry of Testing", parser: getMinistryOfTestingJobs },
    { name: "Direct Company Boards", parser: getCompanyBoardJobs }
];

module.exports = {
    SOURCES
};
