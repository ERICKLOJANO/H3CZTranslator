console.log("this bot has been started");

//TRANSLATOR LIBRARY CONFIGURATIONS
const {Translate} = require('@google-cloud/translate').v2;
require('dotenv').config();

const CREDENTIALS = JSON.parse(process.env.CREDENTIALS);

const translate = new Translate({
    credentials: CREDENTIALS,
    projectId: CREDENTIALS.project_id
});

//TWIT LIBRARY CONFIGURATIONS
var Twit =  require('twit');
var config = require('./config');

var T = new Twit(config);

const needle = require('needle');

//TWITTER API || STREAM TWEETS

// The code below sets the bearer token from your environment variables
// To set environment variables on macOS or Linux, run the export command below from the terminal:
// export BEARER_TOKEN='YOUR-TOKEN'
const token = process.env.BEARER_TOKEN;
require('dotenv').config();


const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream?tweet.fields=created_at';

// this sets up two rules - the value is the search terms to match on, and the tag is an identifier that
// will be applied to the Tweets return to show which rule they matched
// with a standard project with Basic Access, you can add up to 25 concurrent rules to your stream, and
// each rule can be up to 512 characters long

// Edit rules as desired below
const rules = [{
        'value': 'from:ignorerick',
    },
];

async function getAllRules() {

    const response = await needle('get', rulesURL, {
        headers: {
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        console.log("Error:", response.statusMessage, response.statusCode)
        throw new Error(response.body);
    }

    return (response.body);
}

async function deleteAllRules(rules) {

    if (!Array.isArray(rules.data)) {
        return null;
    }

    const ids = rules.data.map(rule => rule.id);

    const data = {
        "delete": {
            "ids": ids
        }
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }

    return (response.body);

}

async function setRules() {

    const data = {
        "add": rules
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 201) {
        throw new Error(response.body);
    }

    return (response.body);

}

function streamConnect(retryAttempt) {

    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ${token}`
        },
        timeout: 20000
    });

    stream.on('data', data => {
        try {
            const json = JSON.parse(data);
            console.log(json);
            console.log("this is working!")
            tweetIt(json.data.text, json.data.id)
            // A successful connection resets retry count.
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail)
                process.exit(1)
            } else {
                // Keep alive signal received. Do nothing.
            }
        }
    }).on('err', error => {
        if (error.code !== 'ECONNRESET') {
            console.log(error.code);
            process.exit(1);
        } else {
            // This reconnection logic will attempt to reconnect when a disconnection is detected.
            // To avoid rate limits, this logic implements exponential backoff, so the wait time
            // will increase if the client cannot reconnect to the stream. 
            setTimeout(() => {
                console.warn("A connection error occurred. Reconnecting...")
                streamConnect(++retryAttempt);
            }, 2 ** retryAttempt)
        }
    });

    return stream;

}


(async () => {
    let currentRules;

    try {
        // Gets the complete list of rules currently applied to the stream
        currentRules = await getAllRules();

        // Delete all rules. Comment the line below if you want to keep your existing rules.
        await deleteAllRules(currentRules);

        // Add rules to the stream. Comment the line below if you don't want to add new rules.
        await setRules();

    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    // Listen to the stream.
    streamConnect(0);
})();



//TRANSLATION CODE
const translateText = async(text, targetLanguage) =>{
    try{
        let [response] = await translate.translate(text, targetLanguage);
        return response;
    }catch(error){
        console.log(`Error at translateText --> ${error}`);
        return 0;
    }
};


//CODE TO POST A TWEET
function tweetIt(txt, id){

    var rawText = txt.toString();
    var handle = "@IGNORErick"
    var tweetID = id;

    var englishText = replaceSpecialChars(rawText);
    

    async function getTranslatedText(textToTranslate, idOfTweet, userHandle) {
        var spanishText = await translateText(textToTranslate, 'es');
        console.log("first function: " + spanishText);

        T.post('statuses/update', {in_reply_to_status_id: idOfTweet, status: userHandle + ' '  + spanishText}, tweeted);

    }


    getTranslatedText(englishText, tweetID, handle);

    
    function tweeted(err, data, response){
        if(err){
            console.log("Something went wrong!");
        }
        else{
            console.log("It worked!\n");
        }
    }
}


//FUNCTION THAT REPLACES TWITTER CHARACTERS INTO READABLE

function replaceSpecialChars(textToChange){
    newText = textToChange.replace('&amp;','&').replace('&gt;','>').replace('&lt;','<');
    return newText;
}