let janusServer='wss://unified-janus.onemandev.tech/websocket';
let protocol='janus-protocol'
let ws=new WebSocket(janusServer,protocol);
let sessionId=null;
let handleId=null;
const pc=new RTCPeerConnection({iceServers:[]});

const dataChannel=pc.createDataChannel("JanusDataChannel",{ordered:true,protocol:protocol});
dataChannel.onopen=(event)=>{
    if(event.target.readyState==='open'){
        console.log('dataChannel opened');
    
        dataChannel.send(JSON.stringify({
            "textroom" : "join",
            "room" : 1234,
            "username" : "Shivansh"+ws.randomString(),
            "display" : "User"+ws.randomString(),
            "transaction" : ws.randomString()
    }));
    }
    
}
dataChannel.onmessage=(msg)=>{
    console.log(msg);
}
ws.onmessage=async(msg)=>{
    console.log('ws recieved msg');
    const data=JSON.parse(msg.data);
    console.log(data)
    if(data.hasOwnProperty('janus')){

        if(data.hasOwnProperty('jsep')&&data.janus==='event'){
            await pc.setRemoteDescription({sdp:data.jsep.sdp,type:data.jsep.type});
            const answer=await pc.createAnswer({offerToReceiveAudio:false,offerToReceiveVideo:false})
            await pc.setLocalDescription({sdp:answer.sdp,type:answer.type});
            
            ws.sendJanusMessage({ "request": "ack" },{type:answer.type,sdp:answer.sdp});
            console.log("answer sent");

        }
        if(data.hasOwnProperty('data')){

            if(data.data.hasOwnProperty('id')&&!data.hasOwnProperty('session_id')){
                sessionId=data.data.id;
                ws.sendJanus({
                    "janus" : "attach",
                    "session_id" : sessionId,                // NEW!
                    "plugin" : "janus.plugin.textroom",
                    "transaction" : ws.randomString()
            });
            }
    
    
            if(data.data.hasOwnProperty('id')&&data.hasOwnProperty('session_id')&&!handleId){
               
            handleId=data.data.id;
            ws.sendJanusMessage( { "request": "setup" });
        //     ws.sendJanusMessage({
        //         "textroom" : "join",
        //         "room" : 1234,
        //         "username" : "shivanshtalwar",
        //         "display" : "shivansh"
        // });
            }

        }

        
    }

    

};
ws.onopen=()=>{
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
    ws.sendJanusMessage=(body,jsep=null)=>{
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

            ws.sendJanus(result);
        }

    }


    ws.sendJanus({
        "janus" : "create",
        "transaction" : ws.randomString()});
}