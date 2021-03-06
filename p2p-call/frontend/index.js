const callerInput = document.getElementById(`caller`),
      calleeInput = document.getElementById(`callee`);

function formatSignal(event, data) {
    return JSON.stringify({ 
        event: event, 
        data: JSON.stringify(data)
    });
}

function registerUser() {
    const callerInfo = new URLSearchParams({ username: callerInput.value });
    const ws = new WebSocket(`wss://${location.hostname}:${location.port}/register?${callerInfo}`);
    ws.onopen = () => console.log(`Signaler Connected`) || (callerInput.disabled = true);
    ws.onclose = ws.onerror = ({reason}) => alert(`Disconnected ${reason}`);

    const rtc = new RTCPeerConnection({iceServers: [{urls: `stun:stun.l.google.com:19302`}]}); //create a WebRTC instance
    rtc.onicecandidate = ({candidate}) => candidate && ws.send(formatSignal(`ice`, candidate)); //if the ice candidate is not null, send it to the peer
    rtc.oniceconnectionstatechange = () => rtc.iceConnectionState == `failed` && rtc.restartIce();
    rtc.ontrack = ({streams}) => { //get remote feed and throw into <video>
        const webcam = document.createElement(`video`);
        webcam.controls = webcam.autoplay = true;
        webcam.srcObject = streams[0];
        document.body.appendChild(webcam);
        streams[0].onended = () => alert(`Disconnected`);
    };
    navigator.mediaDevices.getDisplayMedia({
        video: { 
            width: { ideal: 4096 },
            height: { ideal: 2160 }, //get the highest quality possible
            frameRate: { ideal: 144 },
        }, 
        audio: true
    }).then(stream => {
        for(const track of stream.getTracks())
            rtc.addTrack(track, stream);
    });
    
    ws.onmessage = async ({data}) => { //signal handler
        const signal = JSON.parse(data),
              content = JSON.parse(signal.data);
        switch(signal.event) {
            case `offer-request`:
                console.log(`got offer-request!`);
                const offer = await rtc.createOffer();
                await rtc.setLocalDescription(offer);
                ws.send(formatSignal(`offer`, offer)); //send offer
                console.log(`sent offer!`, offer);
                break;
            case `offer`:
                console.log(`got offer!`, content);
                await rtc.setRemoteDescription(content); //accept offer
                const answer = await rtc.createAnswer();
                await rtc.setLocalDescription(answer);
                ws.send(formatSignal(`answer`, answer)); //send answer
                console.log(`sent answer!`, answer);
                break;
            case `answer`:
                console.log(`got answer!`, content);
                await rtc.setRemoteDescription(content); //accept answer
                break;
            case `ice`:
                console.log(`got ice!`, content);
                rtc.addIceCandidate(content); //add ice candidates
                break;
            default:
                console.log(`Invalid message:`, content);
        }
    };
    return false;
}

function callUser() {
    calleeInput.disabled = true;
    fetch(`/call?${new URLSearchParams({
        caller: callerInput.value,
        callee: calleeInput.value,
    })}`)
    .then(response => response.text())
    .then(error => error && alert(error));
    return false;
}