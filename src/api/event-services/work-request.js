const WorkSubmitService = require('../general-services/work-submit');
const logger = require('../../utils/logging');
const { cacheGetRequest } = require('../../utils/cache-request');
const { CacheMissError } = require('../../cache/cache-utils');
const { handlePagination } = require('../../utils/handlePagination');
const validateRequest = require('../../utils/schema-validator');

const handleWorkRequest = async (workRequest, socket) => {
  const { uuid, pagination } = workRequest;

  try {
    logger.log(`Trying to fetch response to request ${uuid} from cache...`);
    const cachedResponse = await cacheGetRequest(workRequest);
    logger.log(`We found a cached response for ${uuid}. Checking if pagination is needed...`);
    if (pagination) {
      logger.log('Pagination is needed, processing response...');
      cachedResponse.results = handlePagination(cachedResponse.results, pagination);
      logger.log('Paginated');
    } else {
      logger.log('No pagination required.');
    }
    socket.emit(`WorkResponse-${uuid}`, cachedResponse);
    logger.log(`Response sent back to ${uuid}`);
  } catch (e) {
    if (e instanceof CacheMissError) {
      logger.log(e.message);
      logger.log(`Cache miss on ${uuid}, sending it to the worker...`);
      validateRequest(workRequest, 'WorkRequest');
      const { timeout } = workRequest;
      if (Date.parse(timeout) <= Date.now()) {
        throw new Error(`Work request will not be handled as timeout of ${timeout} is in the past...`);
      }
      const workSubmitService = new WorkSubmitService(workRequest);
      await workSubmitService.submitWork();
    } else {
      logger.log('Unexpected error happened while trying to process cached response:', e.message);
    }
  }
};


module.exports = handleWorkRequest;
