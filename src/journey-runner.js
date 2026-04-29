const path = require('path');
const fs = require('fs');

async function runJourney(journeyName, site, context) {
  const journeyPath = path.join(__dirname, '..', 'journeys', `${journeyName}.js`);

  if (!fs.existsSync(journeyPath)) {
    return {
      name: journeyName,
      passed: false,
      failedStep: `Journey file not found: journeys/${journeyName}.js`,
      steps: []
    };
  }

  const journey = require(journeyPath);
  const result = await journey.run(site, context);
  return { name: journeyName, ...result };
}

module.exports = { runJourney };
