const bandwidth = require('node-bandwidth');
const commandLineArgs = require('command-line-args');
const urljoin = require('url-join');
const incomingCallPath = '/call-callback'

const myCreds = {
	userId    : process.env.BANDWIDTH_USER_ID,
	apiToken  : process.env.BANDWIDTH_API_TOKEN,
	apiSecret : process.env.BANDWIDTH_API_SECRET
};

const client = new bandwidth(myCreds);

const applicationName = 'Call-Transfer-Status-Printer';

const getUrl = () => {
    const optionDefinitions = [
        { name: 'callbackUrl', type: String, multiple: false, defaultOption: true }
    ];
    return commandLineArgs(optionDefinitions).callbackUrl;
};

const checkOrCreateApplication = async (url, name) => {
	const apps = await client.Application.list({size: 1000});
	const app = searchForThingInList(apps.applications, 'name', name);
	let tnToCall;
	if (!app) {
		console.log(`No app with name: ${name} found 😢`);
		const app = await client.Application.create({incomingCallUrl: url, name});
		tnToCall = await searchAndOrderNumber('910', app.id);
	}
	else {
		console.log('Found app!');
		if (app.incomingCallUrl !== url) {
			console.log(`Updating application to point to ${url}`)
			await client.Application.update(app.id, {incomingCallUrl: url});
		}
		let tns = [];
		console.log('Searching for associated phone numbers');
		let tnsResponse = await client.PhoneNumber.list({size: 1000});
		let numberFound = false;
		while (!numberFound && tnsResponse.hasNextPage){
			tns = tns.concat(tnsResponse.phoneNumbers);
			let tn = searchForThingInList(tns, 'applicationId', app.id);
			if(tn) {
				console.log('Found number!');
				numberFound = true;
				tnToCall = tn;
			}
			else {
				tnsResponse = await tnsResponse.getNextPage();
			}
		}
		if (!tnToCall) {
			tnToCall = await searchAndOrderNumber('910', app.id);
		}
		else {
			console.log('Found phone number!')
		}
	}
	return tnToCall;
}

const searchTns = (tns, value) => {
	lettn = searchForThingInList(tns, 'applicationId', app.id);

}


// Searches for applicatoin by name
const searchForThingInList = (list, thing, thingName) => {
	console.log(`Searching: ${thing} for value: ${thingName}`);
	for (var i = 0; i < list.length; i+=1) {
			if ( list[i][thing] === thingName) {
				return list[i];
			}
		}
	return false;
};


const searchAndOrderNumber = async (areaCode, appId) => {
	const tn = (await client.AvailableNumber.searchAndOrder('local', { areaCode, quantity : 1 }))[0];
	await client.PhoneNumber.update(tn.id, {applicationId: appId});
	console.log(`Ordered New number id: ${tn.id}`);
	return tn;
}

const main = async () => {
	let url = getUrl();
	url = urljoin(url, incomingCallPath);
	try {
		const tnToCall = await checkOrCreateApplication(url, applicationName);
		console.log(`--------------------`);
		console.log(`Call this number: ${tnToCall.nationalNumber}`);
	}
	catch (err) {
		console.log(err);
	}
};

main();