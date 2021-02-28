let janusServer='wss://master-janus.onemandev.tech/websocket';
let protocol='janus-protocol'
let ws=new WebSocket(janusServer,protocol);
let sessionId=null;
let handleId=null;
const transactions={};
const pc=new RTCPeerConnection({iceServers:[{
    urls:"stun:stun.voip.eutelia.it:3478"
}]});
let mediaStream;
const initMediaDeices=async()=>{
    console.log(navigator.mediaDevices.getSupportedConstraints());
    const devices=await navigator.mediaDevices.enumerateDevices();
    const isAudio=devices.findIndex((res)=>(res.kind==='audioinput'))>-1;
    const isVideo=devices.findIndex((res)=>(res.kind==='videoinput'))>-1;
    mediaStream=await navigator.mediaDevices.getUserMedia({audio:isAudio,video:isVideo});
    if(pc){
        const tracks=await mediaStream.getTracks();
        tracks.forEach((track)=>{
            pc.addTrack(track,mediaStream);
        })

    }
}


ws.onmessage=async(msg)=>{
    console.log('ws recieved msg');
    const data=JSON.parse(msg.data);
    console.log(data)
    if(data.hasOwnProperty('transaction')&&data.hasOwnProperty('janus')){
        if(data.janus!=='ack'){
            transactions[data.transaction](data);
            delete transactions[data.transaction];
        }
        
    }
    // if(data.janus==='success'&&data.hasOwnProperty('data')&&!sessionId){
    //     if(data.data.hasOwnProperty('id')){
    //         sessionId=data.data.id;
    //     }
    // }

};
ws.onopen=async()=>{
    console.log('ws opened');
    ws.sendJanus=(json)=>{
        ws.send(JSON.stringify(json));
    };
    ws.randomString=(len=10)=> {
        charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var randomString = '';
        for (var i = 0; i < len; i++) {
            var randomPoz = Math.floor(Math.random() * charSet.length);
            randomString += charSet.substring(randomPoz,randomPoz+1);
        }
        return randomString;
    }
    ws.sendJanusMessage=(body,jsep=null,callback=()=>{})=>{
    
        if(sessionId&&handleId){
            const result={
                "janus" : "message",
                "session_id" : sessionId,                // NEW!
                "handle_id" : handleId,          // NEW!
                "transaction" : ws.randomString(),
                "body" : body  };
                if(jsep){
                    result.jsep=jsep;
                }
                if(body.janus==='trickle'){
                    result.janus='trickle';
                    result.candidate=body.candidate;
                    delete result['body'];
                }
                transactions[result.transaction]=callback
            ws.sendJanus(result);
        }
        else{
            const result={
                "transaction" : ws.randomString(),
                ...body
                 };
                
            transactions[result.transaction]=callback
            ws.sendJanus(result);
        }

    }
    ws.createSession=(callback=()=>{})=>{

    ws.sendJanusMessage({
        "janus" : "create",
        },null,(data)=>{
            sessionId=data.data.id;
            callback();
        });
    }
    ws.attachPlugin=(plugin='janus.plugin.videoroom',callback=()=>{})=>{
        ws.sendJanusMessage({
            "janus" : "attach",
            "session_id" : sessionId,                // NEW!
            "plugin" : plugin,
    },null,(data)=>{
        console.log('captured handleid');
        console.log(data.data.id);
      handleId=data.data.id;
      callback();  
    });
     }
     pc.onicecandidate=(even)=>{
         if(even.candidate){
             console.log('trickling');
             console.log(even.candidate);
             ws.sendJanusMessage({
                "janus" : "trickle",
                "candidate" : even.candidate
        })
         }

     }

    await initMediaDeices();
    ws.createSession(()=>{
        console.log('session created'+sessionId);
        ws.attachPlugin('janus.plugin.videoroom',()=>{
            console.log('plugin attached'+handleId)
            ws.sendJanusMessage({
                "request" : "join",
                "ptype" : "publisher",
                "room" : 1234,
                "display" : "Shivansh"},null,async(data)=>{

                    const offer=await pc.createOffer({offerToReceiveAudio:false,offerToReceiveVideo:false})
                    pc.setLocalDescription(offer)
                    ws.sendJanusMessage({
                        "request" : "publish"},{sdp:offer.sdp,type:offer.type},(data)=>{
                            if(data.hasOwnProperty('jsep')){
                                pc.setRemoteDescription({sdp:data.jsep.sdp,type:data.jsep.type});
                                
                            }

                    })

                });
        });
    });
 
  
    

}