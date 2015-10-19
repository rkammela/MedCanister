#require "Firebase.class.nut:1.0.0"

// Sample instantiation
const FIREBASE_NAME = "medtrac";
const FIREBASE_SECRET = "rBXYKpbSqbS8FTiBVOoyhGgLOPf1bNhTaHCePBE6";

firebase <- Firebase(FIREBASE_NAME, FIREBASE_SECRET);

MedCanisterState <- {};
MedCanisterState.bottle <- false;
MedCanisterState.button	<- false;
MedCanisterState.lidopen <- false;
MedCanisterState.rain <- false;
MedCanisterState.temperature <- 20.0;
MedCanisterState.tilted	<- false;
MedCanisterState.timestamp <- 0;
//firebase.write("MedCanisterState",MedCanisterState);

MedCanisterSettings <- {};
MedCanisterSettings.medname <- "";
MedCanisterSettings.dosage	<- {};
MedCanisterSettings.dosage.qty <- "";
MedCanisterSettings.dosage.windowstart <- 0;
MedCanisterSettings.dosage.windowend <- 0;
MedCanisterSettings.bottle <- {};
MedCanisterSettings.bottle.volume	<- 0;
MedCanisterSettings.bottle.openedon	<- 0;
MedCanisterSettings.bottle.expiresindays <- 0;
MedCanisterSettings.location <- "HA4%209RA";
MedCanisterSettings.timezone <- -5;
MedCanisterSettings.GPS <-""
MedCanisterSettings.timestamp <- time();
//firebase.write("MedCanisterSettings",MedCanisterSettings);

DailyMedLog <- {};
DailyMedLog.taken <- "no";
DailyMedLog.timestamp <- time();
/*firebase.write("DailyMedLog/2015101",DailyMedLog);
 firebase.write("DailyMedLog/2015102",DailyMedLog);
 firebase.write("DailyMedLog/2015103",DailyMedLog);*/


DeviceMode <- {};
DeviceMode.windowopen <- "";
DeviceMode.taken <- "";
DeviceMode.timestamp <- time();


Debug <- {};
Debug.currentdate <- "x";
Debug.enableagentlog <- true;
Debug.enabledevicelog <- true;
//firebase.write("Debug",Debug);

currentdate <- ""; // Debug.currentdate;


function getdate(){

    if ( Debug.currentdate !=  "x"){
        return Debug.currentdate;
    }
    else {
        local localdatetime = date(time() + MedCanisterSettings.timezone.tofloat())
        return localdatetime.year + "" + (localdatetime.month + 1) + localdatetime.day;
    }

}

function agentlog(show,msg){
    if (Debug.enableagentlog == "true"){
        server.log(msg);
    }
    else if (show == true){
        server.log(msg);
    }
}


function updateDevice(){

    if (DailyMedLog.taken == "no"){
        agentlog(true,"date " + getdate() + " medicine not taken");
    }else {
        agentlog(true,"date " + getdate() + " medicine taken");
    }


}

function readDailyMedLog(){
    firebase.read("/DailyMedLog/" + getdate() , function(data) {

        if (data != null) {

            DailyMedLog = data;

        }
        else {
            DailyMedLog.taken = "no";
            DailyMedLog.timestamp = time();
            agentlog(true,"Write 1");
            firebase.write("DailyMedLog/" + getdate(),DailyMedLog);
        }

        updateDevice();

    });
}

function checkDate(){
    if (getdate() != ""){

        if (currentdate != getdate()) {

            currentdate = getdate();

            readDailyMedLog();

            onDailyMedLog(getdate());
        }


        local windowopen = false;

        local localdatetime = date(time() + MedCanisterSettings.timezone.tofloat())

        local hour = localdatetime.hour;
        local min = localdatetime.min;
        local t = hour + "." + min;


        if ((DailyMedLog.taken == "no") && (MedCanisterSettings.dosage.windowstart.tofloat() > 0) && (MedCanisterSettings.dosage.windowend.tofloat() > 0)){
            if ((MedCanisterSettings.dosage.windowstart.tofloat() <= t.tofloat()) && (MedCanisterSettings.dosage.windowend.tofloat() > t.tofloat())){
                windowopen = true;
            }
            else{
                windowopen = false;
            }
        }

        agentlog(false,DailyMedLog.taken + " " +  DeviceMode.taken + " " + windowopen  + " " + DeviceMode.windowopen);

        if ((DailyMedLog.taken != DeviceMode.taken) || (windowopen != DeviceMode.windowopen)){
            DeviceMode.taken = DailyMedLog.taken;
            DeviceMode.windowopen = windowopen;
            device.send("DeviceMode",DeviceMode);
        }



    }

    imp.wakeup(10.0, checkDate);
}

function backenddatachanged(path, data){
    if (path.find("DailyMedLog") != null){

        if (data != null) {
            if (path.find("taken") != null){
                DailyMedLog.taken = data;
            }
            else{
                DailyMedLog = data;
            }

        }
        else {
            DailyMedLog.taken = "no";
            DailyMedLog.timestamp = time();
            agentlog(true,"Write 2");
            agentlog(true,getdate());
            firebase.write("DailyMedLog/" + getdate(),DailyMedLog);

        }

        updateDevice();
    }
    else if (path.find("MedCanisterSettings") != null){

        readMedCanisterSettings();

    }
    else if (path.find("Debug") != null){
        if (path.find("currentdate") != null){
            Debug.currentdate = data;
        }
        else if (path.find("enableagentlog") != null){
            Debug.enableagentlog = data;
        }
        else if (path.find("enabledevicelog") != null){
            Debug.enabledevicelog = data;
        }
        else{
            Debug = data;
        }


    }
}

// Setup onError handler
function onStreamError(resp) {
    server.error("Firebase encountered and error:");
    server.error(resp.statuscode + " - " + resp.body);
}

function onDailyMedLog(cd){firebase.on("DailyMedLog/" + cd,  backenddatachanged)}

firebase.on("Debug", backenddatachanged);

firebase.on("MedCanisterSettings", backenddatachanged);

function readMedCanisterSettings(){
    firebase.read("MedCanisterSettings" , function(data) {

        if (data != null) {
            MedCanisterSettings = data;
            MedCanisterSettings.dosage.windowstart = MedCanisterSettings.dosage.windowstart.slice(0, MedCanisterSettings.dosage.windowstart.find("T")) ;
            MedCanisterSettings.dosage.windowend = MedCanisterSettings.dosage.windowend.slice(0, MedCanisterSettings.dosage.windowend.find("T")) ;
        }
        else {
            firebase.write("MedCanisterSettings",MedCanisterSettings);
        }

    });
}

readMedCanisterSettings();

// Wrap up the process of opening a stream
firebase.stream("", onStreamError);






device.on("SaveToFirebase", function(data) {

    firebase.write("MedCanisterState",data);
    if ((getdate() != "") && (DailyMedLog.taken != data.taken) && (data.taken == "yes")){
        DailyMedLog.taken = "yes";
        DailyMedLog.timestamp = time();
        agentlog(true,"Write 3");
        firebase.write("DailyMedLog/" + getdate(),DailyMedLog);
    }

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

}

function checkWUForRain(Location)
{
    // Prepare the request
    local WU_URL = "http://api.wunderground.com/api/0e257587f1f70869/conditions/q/" + MedCanisterSettings.location + ".json"
    local body = "";
    local extraHeaders = {}
    local request = http.post(WU_URL,extraHeaders,body);
    request.sendasync(processWUResponse)
}


function processGoogleResponse(incomingDataTable)
{
    // This is the completed-request callback function. It logs the
    // incoming response's message and status code


    if (incomingDataTable.statuscode == 200){
        local data = http.jsondecode(incomingDataTable.body);

        MedCanisterSettings.timezone =  data.rawOffset.tointeger() + data.dstOffset.tointeger();

        firebase.write("MedCanisterSettings/timezone", MedCanisterSettings.timezone);
    }
    else {
        Rain = "nodata";
    }

}

function getTimeZoneFromGoogle()
{
    //GPS = "44.786913,-93.502529"
    if (MedCanisterSettings.GPS != ""){
        // Prepare the request
        local WU_URL = "https://maps.googleapis.com/maps/api/timezone/json?location=" + MedCanisterSettings.GPS + "&timestamp=" + time() + "&key=AIzaSyBxQWBYY1U0-UhYCWZXg3DK6Voy_nPZZSY"
        local body = "";
        local extraHeaders = {}
        local request = http.post(WU_URL,extraHeaders,body);
        request.sendasync(processGoogleResponse)

        imp.wakeup(43200, getTimeZoneFromGoogle); //check after 12 hours

    }
    else{

        imp.wakeup(10, getTimeZoneFromGoogle);

    }

}


device.on("iamready", function(data){
    getTimeZoneFromGoogle();

    checkDate();
});


device.on("checkWUForRain" function(Location) {
    checkWUForRain(Location);
});


// Define an HTTP request handler
function requestHandler(request, response) {
    response.send(200,"Agent responding to web request");
    agentlog(true,"Request came from web");
}

// Register the handler function as a callback
http.onrequest(requestHandler);



