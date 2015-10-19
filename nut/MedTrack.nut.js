/**
 * Created by RajKammela on 10/3/2015.
 */
#require "Firebase.class.nut:1.0.0"

// Sample instantiation
const FIREBASE_NAME = "medtrac";
const FIREBASE_SECRET = "rBXYKpbSqbS8FTiBVOoyhGgLOPf1bNhTaHCePBE6";

firebase <- Firebase(FIREBASE_NAME, FIREBASE_SECRET);

MedCanisterSettings <- {};
MedCanisterSettings.medname <- "";
MedCanisterSettings.dosage	<- {};
MedCanisterSettings.dosage.qty <- "";
MedCanisterSettings.dosage.windowstart <- 0;
MedCanisterSettings.dosage.windowend <- 0;
MedCanisterSettings.dosage.updatedon <- 0;
MedCanisterSettings.bottle <- {};
MedCanisterSettings.bottle.volume	<- 0;
MedCanisterSettings.bottle.openedon	<- 0;
MedCanisterSettings.bottle.expiresindays <- 0;
MedCanisterSettings.timestamp <- 0;

//firebase.write("MedCanisterSettings",MedCanisterSettings);

function getdate(){
    return date().year + "" + (date().month + 1) + date().day;
}

function agentlog(msg){
    server.log(msg);
}

GlobalVariables <- {};
GlobalVariables.currentdate <- getdate();
//firebase.write("GlobalVariables",GlobalVariables);


DailyMedLog <- {};
DailyMedLog.taken <- "no";
DailyMedLog.timestamp <- time();


DeviceMode <- {};
DeviceMode.windowopen <- false;
DeviceMode.taken <- "";
DeviceMode.timestamp <- time();

currentdate <- date(0); // GlobalVariables.currentdate;

//DailyMedLog <- {"2015102" : {"taken":false}};
/*firebase.write("DailyMedLog/2015101",DailyMedLog);
 firebase.write("DailyMedLog/2015102",DailyMedLog);
 firebase.write("DailyMedLog/2015103",DailyMedLog);*/


function updateDevice(){
    agentlog("read " + DailyMedLog.taken);
    if (DailyMedLog.taken == "no"){
        server.log("date " + GlobalVariables.currentdate + " medicine not taken");
    }else {
        server.log("date " + GlobalVariables.currentdate + " medicine taken");
    }


}


function checkDate(){

    if (currentdate != GlobalVariables.currentdate) {
        currentdate = GlobalVariables.currentdate;
        firebase.read("/DailyMedLog/" + GlobalVariables.currentdate , function(data) {

            if (data != null) {

                DailyMedLog = data;

                // agentlog("todays log " + data);
                //server.log(DailyMedLog.taken + " " + DailyMedLog.timestamp);
            }
            else {
                DailyMedLog.taken = "no";
                DailyMedLog.timestamp = time();
                firebase.write("DailyMedLog/" + GlobalVariables.currentdate,DailyMedLog);
                agentlog("1 data doesn't exist");
            }


            updateDevice();


        });

        getTodaysLog(GlobalVariables.currentdate);
    }

    // agentlog("taken " + DailyMedLog.taken);

    local windowopen = false;
    local hour = date().hour;
    //agentlog("hour " + hour);
    if ((DailyMedLog.taken == "no") && (MedCanisterSettings.dosage.windowstart > 0) && (MedCanisterSettings.dosage.windowend > 0)){
        // agentlog(MedCanisterSettings.dosage.windowstart);
        // agentlog(MedCanisterSettings.dosage.windowend);

        if ((MedCanisterSettings.dosage.windowstart <= hour) && (MedCanisterSettings.dosage.windowend > hour)){
            windowopen = true;
        }
        else{
            windowopen = false;
        }
    }
    if ((DailyMedLog.taken != DeviceMode.taken) || (windowopen != DeviceMode.windowopen)){
        DeviceMode.taken = DailyMedLog.taken;
        DeviceMode.windowopen = windowopen;
        device.send("DeviceMode",DeviceMode);

    }
    agentlog("widnow open " + DeviceMode.windowopen );

    imp.wakeup(10.0, checkDate);
}



// Setup onError handler
function onStreamError(resp) {
    server.error("Firebase encountered and error:");
    server.error(resp.statuscode + " - " + resp.body);
}


firebase.on("GlobalVariables", function(path, data) {
    agentlog("GlobalVariables changed" + path);
    if (data != null) {
        if (path.find("GlobalVariables") != null){
            if (path.find("currentdate") != null){
                GlobalVariables.currentdate = data;
            }
            else{
                GlobalVariables = data;
            }
            agentlog("GlobalVariables " + GlobalVariables.currentdate);
            //getTodaysLog(GlobalVariables.currentdate);
        }
        else if (path.find("DailyMedLog") != null){
            if (path.find("taken") != null){
                DailyMedLog.taken = data;
            }
            else{
                DailyMedLog = data;
            }
            agentlog("DailyMedLog " + DailyMedLog.taken);
            updateDevice();
        }


        agentlog("path");
        agentlog(path);
        agentlog(data);
        //server.log("current date was read "  +  GlobalVariables.currentdate);

    }
    else {
        if (path.find("DailyMedLog") != null){
            DailyMedLog.taken = "no";
            DailyMedLog.timestamp = time();
            firebase.write("DailyMedLog/" + cd,DailyMedLog);
        }
        agentlog(path);
        agentlog("data doesn't exist");
    }
});


firebase.read("MedCanisterSettings" , function(data) {

    if (data != null) {

        MedCanisterSettings = data;
        agentlog("settings read");
        // agentlog("todays log " + data);
        //server.log(DailyMedLog.taken + " " + DailyMedLog.timestamp);
    }
    else {
        MedCanisterSettings.medname <- "livothyroxin";
        MedCanisterSettings.dosage	<- {};
        MedCanisterSettings.dosage.qty <- "1ml";
        MedCanisterSettings.dosage.windowstart <- 16;
        MedCanisterSettings.dosage.windowend <- 19;
        MedCanisterSettings.dosage.updatedon <- date();
        MedCanisterSettings.bottle <- {};
        MedCanisterSettings.bottle.volume	<- "50";
        MedCanisterSettings.bottle.openedon	<- date();
        MedCanisterSettings.bottle.expiresindays <- 45;
        MedCanisterSettings.timestamp <- time();
        firebase.write("MedCanisterSettings",MedCanisterSettings);
        agentlog("settings data doesn't exist");
    }

});

firebase.on("MedCanisterSettings", function(path, data) {
    agentlog("MedCanisterSettings changed " + path);

});

// Wrap up the process of opening a stream
firebase.stream("", onStreamError);



function getTodaysLog(cd){

    firebase.on("DailyMedLog/" + cd, function(path, data) {
        agentlog("DailyMedLog changed" + path);
        if (path.find("DailyMedLog") != null){
            agentlog(data);
            if (data != null) {
                if (path.find("taken") != null){
                    DailyMedLog.taken = data;
                }
                else{
                    DailyMedLog = data;
                }
                agentlog("todays log path " + path);
                agentlog("todays log " + data);
                //server.log(DailyMedLog.taken + " " + DailyMedLog.timestamp);
            }
            else {
                DailyMedLog.taken = "no";
                DailyMedLog.timestamp = time();
                firebase.write("DailyMedLog/" + cd,DailyMedLog);
                agentlog("2 data doesn't exist");
            }

            updateDevice();
        }
        else if (path.find("MedCanisterSettings") != null){

            firebase.read("MedCanisterSettings" , function(data) {

                if (data != null) {

                    MedCanisterSettings = data;
                    agentlog("settings read after change " + MedCanisterSettings.dosage.qty);
                    //agentlog("todays log " + data);
                    //server.log(DailyMedLog.taken + " " + DailyMedLog.timestamp);
                }

            });
        }
    });

}


checkDate();
//getTodaysLog();
//getTodaysLog();

MedCanisterState <- {};
MedCanisterState.bottle <- false;
MedCanisterState.button	<- false;
MedCanisterState.lidopen <- false;
MedCanisterState.rain <- false;
MedCanisterState.temperature <- 20.0;
MedCanisterState.tilted	<- false;
MedCanisterState.timestamp <- date();


device.on("SaveToFirebase", function(data) {

    firebase.write("MedCanisterState",data);

});



function processWUResponse(incomingDataTable)
{
    // This is the completed-request callback function. It logs the
    // incoming response's message and status code

    local Rain = "nodata";

    if (incomingDataTable.statuscode == 200){
        local data = http.jsondecode(incomingDataTable.body);
        if (data.current_observation.precip_today_metric.tofloat() > 0){
            Rain = "yes" ;
        }
        else{
            Rain = "no";
        }
    }
    else {
        Rain = "nodata";
    }
    device.send("Rain",Rain);
    //server.log("Agent Rain:" + Rain);
}

function checkWUForRain(Location)
{
    // Prepare the request
    local WU_URL = "http://api.wunderground.com/api/0e257587f1f70869/conditions/q/" + Location + ".json"
    local body = "";
    local extraHeaders = {}
    local request = http.post(WU_URL,extraHeaders,body);

    request.sendasync(processWUResponse)
}


device.on("checkWUForRain" function(Location) {
    checkWUForRain(Location);
});


// Define an HTTP request handler
function requestHandler(request, response) {
    response.send(200,"Agent responding to web request");
    agentlog("Request came from web");
}

// Register the handler function as a callback
http.onrequest(requestHandler);




//*************************************************
// Phant Stuff
//*************************************************
local publicKey = "1nLlGZWw6rf3ZGq0JlOq"; // Your Phant public key
local privateKey = "0mrDnlpYjvfJ8Aram4br"; // The Phant private key
local phantServer = "data.sparkfun.com"; // Your Phant server, base URL, no HTTP

/////////////////////
// postData Action //
/////////////////////
// When the agent receives a "postData" string from the device, use the
// dataString string to construct a HTTP POST, and send it to the server.
device.on("postData", function(dataString) {

    agentlog("Sending " + dataString); // Print a debug message

    // Construct the base URL: https://data.sparkfun.com/input/PUBLIC_KEY:
    local phantURL = "https://" +  phantServer + "/input/" + publicKey;
    // Construct the headers: e.g. "Phant-Priave-Key: PRIVATE_KEY"
    local phantHeaders = {"Phant-Private-Key": privateKey, "connection": "close"};
    // Send the POST to phantURL, with phantHeaders, and dataString data.
    local request = http.post(phantURL, phantHeaders, dataString);

    // Get the response from the server, and send it out the debug window:
    local response = request.sendsync();
    agentlog("Phant response: " + response.body);
});
















//checkWUForRain("seattle");
//checkWUForRain("Wilmington%20NC");