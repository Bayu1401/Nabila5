const LineAPI = require('./api');
const { Message, OpType, Location } = require('../curve-thrift/line_types');
let exec = require('child_process').exec;

const myBot = ['uae3a03c3e6f216b3db1a38e7f43c708f','uccea3b6c0299b898b563ad3d3aa7df04','u1f818b58103b9f215b28d6123cf3d6af','uf8ea3fe9329fbf12f8c54c60ed5bec63','u2ef820be923b550fb1bc688a2ca5b88a','ubc809f75ec35062965097042ad509825'];


function isAdminOrBot(param) {
    return myBot.includes(param);
}


class LINE extends LineAPI {
    constructor() {
        super();
        this.receiverID = '';
        this.checkReader = [];
        this.stateStatus = {
            cancel: 0,
            kick: 0,
        }
    }

    getOprationType(operations) {
        for (let key in OpType) {
            if(operations.type == OpType[key]) {
                if(key !== 'NOTIFIED_UPDATE_PROFILE') {
                    console.info(`[* ${operations.type} ] ${key} `);
                }
            }
        }
    }

    poll(operation) {
        if(operation.type == 25 || operation.type == 26) {
            const txt = (operation.message.text !== '' && operation.message.text != null ) ? operation.message.text : '' ;
            let message = new Message(operation.message);
            this.receiverID = message.to = (operation.message.to === myBot[0]) ? operation.message.from_ : operation.message.to ;
            Object.assign(message,{ ct: operation.createdTime.toString() });
            this.textMessage(txt,message)
        }

        if(operation.type == 13 && this.stateStatus.cancel == 1) {
            this.cancelAll(operation.param1);
        }

        if(operation.type == 19 && this.stateStatus.protect == 1) { //ada kick
            // op1 = group nya
            // op2 = yang 'nge' kick
            // op3 = yang 'di' kick
            if(isAdminOrBot(operation.param3)) {
                this._invite(operation.param1,[operation.param3]);
            }
            if(!isAdminOrBot(operation.param2)){
                this._kickMember(operation.param1,[operation.param2]);
            } 

        }
	
	if(operation.type == 32 && this.stateStatus.ckick == 1) { //ada yang cancel
            // op1 = group nya
            // op2 = yang 'nge' update
            if(!isAdminOrBot(operation.param2)) {
                this._kickMember(operation.param1,[operation.param2]);
            }
        }

        if(operation.type == 13 && this.stateStatus.ikick == 1) { //ada yang invite
            // op1 = group nya
            // op2 = yang 'nge' update
            if(!isAdminOrBot(operation.param2)) {
                this._kickMember(operation.param1,[operation.param2]);
            }
        }
	 
	if(operation.type == 19) { //ada kick
            // op1 = group nya
            // op2 = yang 'nge' kick
            // op3 = yang 'di' kick
            if(isAdminOrBot(operation.param3)) {
                this._invite(operation.param1,[operation.param3]);    
            }
		
        }
	    
        if(operation.type == 11 && this.stateStatus.qrp == 1) { // ada update
            // op1 = group nya
            // op2 = yang 'nge' update
            if(!isAdminOrBot(operation.param2)) {
                this._kickMember(operation.param1,[operation.param2]);
            }

        }
	    
        if(operation.type == 17 && this.stateStatus.kill == 1) { //ada join
            if(!isAdminOrBot(operation.param2)) {
                this._kickMember(operation.param1,[operation.param2]);
            }
        }
	   
        if(operation.type == 55){ //ada reader

            const idx = this.checkReader.findIndex((v) => {
                if(v.group == operation.param1) {
                    return v
                }
            })
            if(this.checkReader.length < 1 || idx == -1) {
                this.checkReader.push({ group: operation.param1, users: [operation.param2], timeSeen: [operation.param3] });
            } else {
                for (var i = 0; i < this.checkReader.length; i++) {
                    if(this.checkReader[i].group == operation.param1) {
                        if(!this.checkReader[i].users.includes(operation.param2)) {
                            this.checkReader[i].users.push(operation.param2);
                            this.checkReader[i].timeSeen.push(operation.param3);
                        }
                    }
                }
            }
        }

        if(operation.type == 13) { // diinvite
            if(isAdminOrBot(operation.param2)) {
                return this._acceptGroupInvitation(operation.param1);
            } else {
                return this._cancel(operation.param1,myBot);
            }
        }
        this.getOprationType(operation);
    }

    async cancelAll(gid) {
        let { listPendingInvite } = await this.searchGroup(gid);
        if(listPendingInvite.length > 0){
            this._cancel(gid,listPendingInvite);
        }
    }

    async searchGroup(gid) {
        let listPendingInvite = [];
        let thisgroup = await this._getGroups([gid]);
        if(thisgroup[0].invitee !== null) {
            listPendingInvite = thisgroup[0].invitee.map((key) => {
                return key.mid;
            });
        }
        let listMember = thisgroup[0].members.map((key) => {
            return { mid: key.mid, dn: key.displayName };
        });

        return { 
            listMember,
            listPendingInvite
        }
    }

    setState(seq) {
        if(isAdminOrBot(seq.from)){
            let [ actions , status ] = seq.text.split(' ');
            const action = actions.toLowerCase();
            const state = status.toLowerCase() == 'on' ? 1 : 0;
            this.stateStatus[action] = state;
            this._sendMessage(seq,` ✥§†ą†µ§✥----------------------☆☆\n${JSON.stringify(this.stateStatus)}`);
        }
    }

    mention(listMember) {
        let mentionStrings = [''];
        let mid = [''];
        for (var i = 0; i < listMember.length; i++) {
            mentionStrings.push('@'+listMember[i].displayName+'\n');
            mid.push(listMember[i].mid);
        }
        let strings = mentionStrings.join('');
        let member = strings.split('@').slice(1);
        
        let tmp = 0;
        let memberStart = [];
        let mentionMember = member.map((v,k) => {
            let z = tmp += v.length + 1;
            let end = z - 1;
            memberStart.push(end);
            let mentionz = `{"S":"${(isNaN(memberStart[k - 1] + 1) ? 0 : memberStart[k - 1] + 1 ) }","E":"${end}","M":"${mid[k + 1]}"}`;
            return mentionz;
        })
        return {
            names: mentionStrings.slice(1),
            cmddata: { MENTION: `{"MENTIONEES":[${mentionMember}]}` }
        }
    }

    async recheck(cs,group) {
        let users;
        for (var i = 0; i < cs.length; i++) {
            if(cs[i].group == group) {
                users = cs[i].users;
            }
        }
        
        let contactMember = await this._getContacts(users);
        return contactMember.map((z) => {
                return { displayName: z.displayName, mid: z.mid };
            });
    }

    removeReaderByGroup(groupID) {
        const groupIndex = this.checkReader.findIndex(v => {
            if(v.group == groupID) {
                return v
            }
        })

        if(groupIndex != -1) {
            this.checkReader.splice(groupIndex,1);
        }
    }

    async textMessage(textMessages, seq) {
        const [ cmd, payload ] = textMessages.split(' ');
        const txt = textMessages.toLowerCase();
        const messageID = seq.id;

        if(txt == 'cancel' && this.stateStatus.cancel == 1) {
            this.cancelAll(seq.to);
        }
	    
	if(txt == 'respons' && isAdminOrBot(seq.from)) {
             let { mid,displayName} = await this._client.getProfile();
             this._sendMessage(seq,'•'+displayName);
        }  
	    
	if(txt == 'test' && isAdminOrBot(seq.from)) {
            this._sendMessage(seq,'ok boss!!');
        }
	    
	if(txt == 'absen' && isAdminOrBot(seq.from)) {
            this._sendMessage(seq, 'hadir boss kuh !!');
        }
	    
        if(txt == 'restart' && isAdminOrBot(seq.from)) {
            this._client.removeAllMessages();
            this._sendMessage(seq,'done');
        }
	    
	if(txt ==='caw' && isAdminOrBot(seq.from)) {
            this._sendMessage(seq,'bye bye!!');
            this._leaveGroup(seq.to);
        }
	    
	if(txt == 'gift' && isAdminOrBot(seq.from)) {
            seq.contentType=9
            seq.contentMetadata = {'PRDID': 'a0768339-c2d3-4189-9653-2909e9bb6f58','PRDTYPE': 'THEME','MSGTPL': '5'};                                                     this._client.sendMessage(1,seq); 
        }
	    
        if(txt == 'aku' && isAdminOrBot(seq.from)) {
            seq.contentType=13;
            seq.contentMetadata = {mid: seq.from};
            this._client.sendMessage(1,seq);
        }
	    
	if(txt == 'tagall' && isAdminOrBot(seq.from)) {
        let{listMember} = await this.searchGroup(seq.to);
               const mentions = await this.mention(listMember);
               seq.contentMetadata = mentions.cmddata;
               await this._sendMessage(seq,mentions.names.join(''));
        }
	    
        if(txt == 'key' && isAdminOrBot(seq.from)) {
            this._sendMessage(seq, '•<✬[❂]>cфмaпd lιѕт<[❂]✬>•\n\n[♚]тagall\n[♚]clear\n[♚]ĸerпel\n[♚]reѕpфпѕ\n[♚]caпcel\n[♚]prфтecт фп|фғғ\n[♚]caпcel фп|фғғ\n[♚]iĸιcĸ фп|фғғ\n[♚]ckick фп|фғғ\n[♚]ĸιcĸ фп|фғғ\n[♚]ĸιll фп|фғғ\n[♚]qrp фп|фғғ\n[♚]reѕтarт\n[♚]creaтфr\n[♚]ѕpeed\n[♚]gιғт\n[♚]cнecĸ\n[♚]ѕeт\n[♚]фυrl\n[♚]cυrl\n[♚]caw\n[♚]υѕιr@\n[♚]ғυcĸ\n[♚]lag\n[♚]aĸυ\n\n   •<✬[❂]>вყ顔なし<[❂]✬>•');                                                                        
        }
	    
        if(txt == 'creator'){
            seq.contentType=13;                                                            seq.contentMetadata = { mid:'uccea3b6c0299b898b563ad3d3aa7df04'};
            this._client.sendMessage(1,seq);
        }
	    
        if(txt == 'speed' && isAdminOrBot(seq.from)) {
            const curTime = Math.floor(Date.now() / 1000);
            const rtime = Math.floor(Date.now() / 1000) - curTime;
            this._sendMessage(seq, `${rtime} second`);
        }

        if(txt === 'kernelo') {
            exec('uname -a;ptime;id;whoami',(err, sto) => {
                this._sendMessage(seq, sto);
            })
        }

        if(txt === 'sapu' && this.stateStatus.kick == 1 && isAdminOrBot(seq.from)) {
            let { listMember } = await this.searchGroup(seq.to);
            for (var i = 0; i < listMember.length; i++) {
                if(!isAdminOrBot(listMember[i].mid)){
                    this._kickMember(seq.to,[listMember[i].mid])
                }
            }
        }

        if(txt == 'set' && isAdminOrBot(seq.from)) {
            this._sendMessage(seq, `Setpoint for check reader.`);
            this.removeReaderByGroup(seq.to);
        }

        if(txt == 'clear') {
            this.checkReader = []
            this._sendMessage(seq, `Remove all check reader on memory`);
        }  

        if(txt == 'check' && idAdminOrBot(seq.from)){
            let rec = await this.recheck(this.checkReader,seq.to);
            const mentions = await this.mention(rec);
            seq.contentMetadata = mentions.cmddata;
            await this._sendMessage(seq,mentions.names.join(''));
            
        }

        if(txt == 'setpoint for check reader .') {
            this.searchReader(seq);
        }

        if(txt == 'clearall') {
            this.checkReader = [];
        }

        const action = ['cancel on','cancel off','ikick on','ikick off','protect on','protect off','qrp on','qrp off','kill on','kill off','ckick on','ckick off','kick on','kick off']
        if(action.includes(txt)) {
            this.setState(seq)
        }
	
        if(txt == 'myid') {
            this._sendMessage(seq,`${seq.from}`);
        }

        if(txt == 'speedtest' && isAdminOrBot(seq.from)) {
            exec('speedtest-cli --server 6581',(err, res) => {
                    this._sendMessage(seq,res)
            })
        }

        const joinByUrl = ['ourl','curl'];
        if(joinByUrl.includes(txt)) {
            let updateGroup = await this._getGroup(seq.to);
            updateGroup.preventJoinByTicket = true;
            if(txt == 'ourl' && isAdminOrBot(seq.from)) {
                updateGroup.preventJoinByTicket = false;
                const groupUrl = await this._reissueGroupTicket(seq.to)
                this._sendMessage(seq,`http://line://ti/g/${groupUrl}`);
            }
            await this._updateGroup(updateGroup);
        }

        if(cmd == 'join') {
            const [ ticketId ] = payload.split('g/').splice(-1);
            let { id } = await this._findGroupByTicket(ticketId);
            await this._acceptGroupInvitationByTicket(id,ticketId);
        }
  
	if(cmd == 'left'  && isAdminOrBot(seq.from)) { //untuk left dari group atau spam group contoh left <alfath>
            this.leftGroupByName(payload)
        }
	    
        if(cmd == 'usir' && isAdminOrBot(seq.from)) {
           let target = payload.replace('@','');
           let group = await this._getGroups([seq.to]);
           let gm = group[0].members;
             for(var i = 0; i < gm.length; i++){
                if(gm[i].displayName == target){
                  target = gm[i].mid;
                }
            }
            this._kickMember(seq.to,[target]);
        }
		  
        if(cmd == 'lag' && isAdminOrBot(seq.from)) {
           for (var i = 0; i < 200; i++) {
             this._sendMessage(seq,'¯\_(ツ)_/¯');
            }

        }
        if(cmd == 'fuck' && isAdminOrBot(seq.from)) {
           for (var i = 0; i < 200; i++) {
             this._sendMessage(seq,'┌∩┐(◣_◢)┌∩┐');
            }

        }
 
        if(cmd === 'ip') {
            exec(`curl ipinfo.io/${payload}`,(err, res) => {
                const result = JSON.parse(res);
                if(typeof result.error == 'undefined') {
                    const { org, country, loc, city, region } = result;
                    try {
                        const [latitude, longitude ] = loc.split(',');
                        let location = new Location();
                        Object.assign(location,{ 
                            title: `Location:`,
                            address: `${org} ${city} [ ${region} ]\n${payload}`,
                            latitude: latitude,
                            longitude: longitude,
                            phone: null 
                        })
                        const Obj = { 
                            text: 'Location',
                            location : location,
                            contentType: 0,
                        }
                        Object.assign(seq,Obj)
                        this._sendMessage(seq,'Location');
                    } catch (err) {
                        this._sendMessage(seq,'Not Found');
                    }
                } else {
                    this._sendMessage(seq,'Location Not Found , Maybe di dalem goa');
                }
            })
        }
    }

}

module.exports = new LINE();
