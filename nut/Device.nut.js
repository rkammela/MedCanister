// Start of program
enabledevicelog <- "false";

function devicelog(show,msg){
    if (enabledevicelog == "true"){
        server.log(msg);
    }
    else if (show == true){
        server.log(msg);
    }
}


disconnectedFlag <- false;

originalssid <- imp.getssid();


function disconnectionHandler(reason) {
    // Function called automatically if the agent link is lost
    if (reason != SERVER_CONNECTED) disconnectedFlag = true;
}

server.setsendtimeoutpolicy(RETURN_ON_ERROR, WAIT_TIL_SENT, 60.0);
server.onunexpecteddisconnect(disconnectionHandler);


wifi <- {
    passwords = {},
    available = [],
    secure = [],
    open = [],
    current = -1
};

wifi.passwords["KWN"] <- "m@rch1p0y@nu";
wifi.passwords["Deeksha"] <- "vij@9";

function scanForHotSpots(){
    wifi.available = imp.scanwifinetworks();

    foreach (hotspot in wifi.available)
    {
        if (hotspot.open)
        {
            wifi.open.append({ ssid = hotspot.ssid })
        }
        else
        {
            if (wifi.passwords.rawin(hotspot.ssid)) {
                wifi.secure.append({ ssid = hotspot.ssid, pw = wifi.passwords[hotspot.ssid] })
            }
        }

        //local string = format("%s, open = %s, channel = %u, strength = %s ", hotspot.ssid,hotspot.open.tostring(), hotspot.channel, hotspot.rssi.tostring());
        //devicelog(true,string);
    }
}

function getNextHotSpot(){
    if (wifi.current < (wifi.secure.len() + wifi.open.len() - 1)) {
        wifi.current++;
        if (wifi.current < wifi.secure.len()){
            devicelog(true,wifi.secure[wifi.current].ssid);
        }
        else {
            devicelog(true,wifi.open[wifi.current - wifi.secure.len()].ssid);
        }

    }
    else{
        devicelog(true,"out of bound");
    }
}

function onConnectedCallback(state) {
    // If we're connected...
    if (state == SERVER_CONNECTED)
    {
        devicelog(true,"Device now connected to " + imp.getssid() + ". Previous SSID was " + originalssid);

        agent.on("Rain", setRainState);
        agent.send("checkWUForRain",geoLocation);

    }
    else
    {
        tryNextHotSpot();
    }
}

function connectToHotSpot(ssid, pw){
    devicelog(true,format("Device attempting to connect to %s with password %s",ssid,pw));

    // Wait for the WiFi buffer to empty before disconnecting
    server.flush(60.0);
    server.disconnect();

    // Change the WiFI configuration with the passed parameters
    imp.setwificonfiguration(ssid, pw);

    // Attempt to reconnect asynchronously
    server.connect(onConnectedCallback, 30);

}

function tryNextHotSpot(){
    if (wifi.current < (wifi.secure.len() + wifi.open.len() - 1)) {
        wifi.current++;
        if (wifi.current < wifi.secure.len()){
            connectToHotSpot(wifi.secure[wifi.current].ssid,wifi.secure[wifi.current].pw);
        }
        else {
            connectToHotSpot(wifi.open[wifi.current - wifi.secure.len()].ssid,"");
        }
    }
    else{
        wifi.current = -1;
    }
}

function connectIfNotConnected(){
    if (!server.isconnected()){
        scanForHotSpots();
        tryNextHotSpot();
    }
    else{
        devicelog(false,"i am connected to " + originalssid);
    }
}

connectIfNotConnected();




//Test automatic wifi scan and connect
//scanForHotSpots();
//tryNextHotSpot();


// Globals
//geoLocation <- "Wilmington%20NC";
geoLocation <- "pahrump%20nv";
//geoLocation <- "HA4%209RA";
//geoLocation <- "seattle";
//geoLocation <- "Shakopee";

connectInterval <- 10;

lidOpenLightThreshold <- 150000;
tiltThreshold <- 210000;


MedCanisterState <- {};
MedCanisterState.bottle <- false;
MedCanisterState.button	<- false;
MedCanisterState.lidopen <- false;
MedCanisterState.rain <- "nodata";
MedCanisterState.temperature <- 0.0;
MedCanisterState.tilted	<- false;
MedCanisterState.windowopen <- false;
MedCanisterState.taken <- false;
MedCanisterState.timestamp <- 0 ; //date();

DeviceMode <- {};
DeviceMode.windowopen <- false;
DeviceMode.taken <- false;
DeviceMode.timestamp <- time();


// Define Hardware pins

// Pin1 <----> Button <----> 3.3v
BottleDetect <- hardware.pin1;
// 3.3v <----> LDR & Tilt Parallel <----> Pin2 <----> 10KOhm <----> Gnd
TiltAndLight <- hardware.pin2;
// Pin5 <----> Button <----> Gnd
PushButton   <- hardware.pin5;
// 3.3v <----> tmp36 pin 1, Pin 7 <----> tmp36 pin 2, Gnd <----> tmp36 pin 3
Temperature  <- hardware.pin7;

Speaker      <- hardware.pin8;
Servo        <- hardware.pin9;


//configure Bottle detection pin

buttonchangepending <- false;


function BottleDetectChanged() {

    if (BottleDetect.read() == 1) {
        MedCanisterState.bottle = true;
        MedCanisterState.taken = "yes";
        setStatus();
        devicelog(false,"Bottle in the canister!");
    } else {
        MedCanisterState.bottle = false;
        devicelog(false,"Bottle removed!");
    }
    buttonchangepending = false;

}


function BottleButtonChanged()
{
    if (MedCanisterState.taken == "no"){
        if (!buttonchangepending)
        {
            buttonchangepending = true;
            imp.wakeup(0.100, BottleDetectChanged);
        }
    }
}


BottleDetect.configure(DIGITAL_IN_WAKEUP, BottleButtonChanged);




//Configure Tilt and LDR as analog input
TiltAndLight.configure(ANALOG_IN);


// function returns Tilt and Lid state
function checkTiltAndLight() {
    local supplyVoltage = hardware.voltage();
    local voltage = supplyVoltage * TiltAndLight.read();

    //devicelog(false,voltage);

    if (voltage > tiltThreshold){
        MedCanisterState.tilted = true;
        return "Tilted";
    }
    else{
        MedCanisterState.tilted = false;
        if (voltage < lidOpenLightThreshold){
            MedCanisterState.lidopen = true;
            return "Opened";
        }
        else{
            MedCanisterState.lidopen = false;
            return "Closed";
        }

    }
}


//Configure push button

function PushButtonChanged() {
    if (PushButton.read() == 0) {
        MedCanisterState.button = true;
        devicelog(false,"Button Pressed!");
    } else {
        MedCanisterState.button = false;
        devicelog(false,"Button Released!");
    }
}

PushButton.configure(DIGITAL_IN_PULLUP, PushButtonChanged);



//Configure Temperature input
Temperature.configure(ANALOG_IN);
//function returns temperature from tmp36
function getTemperature() {
    local supplyVoltage = hardware.voltage();
    local voltage = supplyVoltage * Temperature.read() / 65535.0;
    local c = (voltage - 0.5) * 100 ;
    local celsius = format("%.01f", c);
    return(celsius);
}



//Configure Speaker
Speaker.configure(DIGITAL_OUT);
// function to beep
function beep(){
    for (local i = 0; i < 80; i++)
    {
        hardware.pin1.write(1);
        imp.sleep(0.001);
        hardware.pin1.write(0);
        imp.sleep(0.002);
    }

    for (local i = 0; i < 100; i++)
    {
        hardware.pin1.write(1);
        imp.sleep(0.001);
        hardware.pin1.write(0);
        imp.sleep(0.001);
    }
}


// Define visual output servo
// These constants may be different for your servo
const SERVO_MIN = 0.03;
const SERVO_MAX = 0.1;

// Create global variable for the pin to which the servo is connected
// then configure the pin for PWM
Servo.configure(PWM_OUT, 0.02, SERVO_MIN);

// Define a function to control the servo.
// It expects an angle value between -80.0 and 80.0
function setServoDegrees(value) {
    local scaledValue = (value + 81) / 161.0 * (SERVO_MAX - SERVO_MIN) + SERVO_MIN;
    Servo.write(scaledValue);
    imp.sleep(0.5);
    Servo.write(0);
    devicelog(false,"servo angle " + value + " scaled valut " + scaledValue);
}

// Function to set visual status
function setVisualStatus(value){
    if (value == "Pending"){
        setServoDegrees(80);  // Top
    }
    else if (value == "Sunny"){
        setServoDegrees(-20); // Bottom
    }
    else if (value == "Rain"){
        setServoDegrees(30); // Middle
    }
    //devicelog(false,value);
}

function setStatus(){
    if (MedCanisterState.taken == "no"){
        setVisualStatus("Pending");
    } else {
        if (MedCanisterState.rain == "no"){
            setVisualStatus("Sunny") ;
        }
        else if (MedCanisterState.rain == "yes") {
            setVisualStatus("Rain");
        }
    }
}



// Global Variables

function setRainState(state){
    MedCanisterState.rain = state;
    setStatus();
}


function SetDeviceMode(state){
    devicelog(false,"Device window open " + state.windowopen);
    MedCanisterState.windowopen = state.windowopen;
    MedCanisterState.taken = state.taken;
    setStatus();
}


function SaveToFirebase()
{
    MedCanisterState.temperature = getTemperature();
    MedCanisterState.timestamp = time();
    agent.send("SaveToFirebase", MedCanisterState);
}

function mainLoop(){
    checkTiltAndLight();
    SaveToFirebase();
    imp.wakeup(10.0, mainLoop);
}

agent.on("Rain", setRainState);
agent.on("DeviceMode",SetDeviceMode);

agent.send("iamready","iamready");
agent.send("checkWUForRain",geoLocation);

Servo.write(0);
MedCanisterState.taken = "no";
setStatus();

mainLoop();







