const bandwidth = require('node-bandwidth');

const express = require('express');
let app = express();
const bodyParser = require('body-parser');
const commandLineArgs = require('command-line-args');
const http = require('http').Server(app);
const url = require('url');

const transferPath = '/transfer-callback';
const myCreds = {
	userId    : process.env.BANDWIDTH_USER_ID,
	apiToken  : process.env.BANDWIDTH_API_TOKEN,
	apiSecret : process.env.BANDWIDTH_API_SECRET
};

const client = new bandwidth(myCreds);


app.use(bodyParser.json());
app.set('port', (process.env.PORT || 3000));

app.get('/', function (req, res) {
	//console.log(req);
	res.send('Hello World');
});


const getNumber = () => {
    const optionDefinitions = [
        { name: 'transferTo', type: String, multiple: false, defaultOption: true }
    ];
    return commandLineArgs(optionDefinitions).transferTo;
};

const getIncomingCallHandler = (payload) => {
	const eventHandlers = {
		answer : transfer,
		hangup : printCDR
	};
	let handler;
	if (eventHandlers.hasOwnProperty(payload.eventType)) {
		handler = eventHandlers[payload.eventType];
	}
	else {
		handler = defaultHandler;
	}
	return handler;
}

const getTransferHandler = (payload) => {
	const eventHandlers = {
		hangup : printCDR
	};
	let handler;
	if (eventHandlers.hasOwnProperty(payload.eventType)) {
		handler = eventHandlers[payload.eventType];
	}
	else {
		handler = defaultTransferHandler;
	}
	return handler;
}

const defaultTransferHandler = (req) => {
	printer('TRANSFER EVENT', req.body);
}

const defaultHandler = (req) => {
	printer('INCOMING CALL EVENT', req.body);
}

const errorPrinter = (err, reason) => {
	console.log(reason);
	console.log(err);
}

const printer = (title, data) => {
	console.log(`----------------------<${title}>----------------------`);
	console.log(data);
	console.log(`----------------------</${title}>---------------------`);
}

const transfer = async (req) => {
	const transferTo = app.transferTo;
	const callId = req.body.callId;
	const baseUrl = req.hostname;
	const callbackUrl = `http://${baseUrl}${transferPath}`;
	const transferPayload = {
		transferTo,
		callbackUrl
	}
	printer('TRANSFER TO PAYLOAD', transferPayload);
	try {
		const transferCallId = await client.Call.transfer(callId, transferPayload)
		printer('TRANSFER CALL ID', transferCallId)
		//const response = await client.Call.update(transferCallId, {callbackUrl});
	}
	catch (err) {
		errorPrinter(err, 'Transfering Call Error');
	}
	return;
};

const printCDR = async (req) => {
	printer('HANGUP EVENT', req.body);
	const callId = req.body.callId;
	try {
		const callEvents = await client.Call.getEvents(callId);
		printer('Call Events', callEvents);
	}
	catch (err) {
		errorPrinter(err, 'Getting Call Events Error');
	}
}

app.post('/call-callback', async (req, res) => {
	res.sendStatus(200);
	const handler = getIncomingCallHandler(req.body);
	handler(req);
});

app.post(transferPath, async (req, res) => {
	res.sendStatus(200);
	const handler = getTransferHandler(req.body)
	handler(req)
});

const server = app.listen(3000,  () => {
    let host = server.address().address
    let port = server.address().port
    app.transferTo = getNumber();
    console.log("Example app listening at http://%s:%s", host, port)
});

