//Requires
const modulename = 'WebServer:Intercom';
const clone = require('clone');
const { dir, log, logOk, logWarn, logError } = require('../extras/console')(modulename);

//Helper functions
const isUndefined = (x) => { return (typeof x === 'undefined') };
const now = () => { return Math.round(Date.now() / 1000) };

/**
 * Intercommunications endpoint
 * @param {object} ctx
 */
module.exports = async function Intercom(ctx) {
    //Sanity check
    if(isUndefined(ctx.params.scope)){
        return ctx.utils.error(400, 'Invalid Request');
    }
    let scope = ctx.params.scope;

    let postData = clone(ctx.request.body);
    postData.txAdminToken = true;

    //Delegate to the specific scope functions
    if(scope == 'monitor'){
        try {
            globals.monitor.handleHeartBeat('http', postData);
            const extractData = {
                "$statsVersion": 2,
                txAdminVersion: GlobalData.txAdminVersion,
                txAdminIsDefaultPort: (GlobalData.txAdminPort == 40120),
                txAdminUptime: Math.round(process.uptime()),
                fxServerUptime: globals.fxRunner.getUptime(),
                discordBotStats: (globals.discordBot.config.enabled)? globals.discordBot.usageStats : false,
                banlistEnabled: globals.playerController.config.onJoinCheckBan,
                whitelistEnabled: globals.playerController.config.onJoinCheckWhitelist,     
                admins: (globals.authenticator.admins)? globals.authenticator.admins.length : 1,
                tmpLooksLikeRecipe: (globals.fxRunner.config.serverDataPath || "").includes('.base'),
            }
            const outData = Object.assign(extractData, globals.databus.txStatsData);
            return ctx.send(JSON.stringify(outData, null, 2));
        } catch (error) {
            return ctx.send({
                txAdminVersion: GlobalData.txAdminVersion,
                success: false
            });
        }

    }else if(scope == 'resources'){
        if(!Array.isArray(postData.resources)){
            return ctx.utils.error(400, 'Invalid Request');
        }
        globals.databus.resourcesList = {
            timestamp: new Date(),
            data: postData.resources
        }

    }else if(scope == 'logger'){
        if(!Array.isArray(postData.log)){
            return ctx.utils.error(400, 'Invalid Request');
        }
        globals.databus.serverLog = globals.databus.serverLog.concat(postData.log)

    }else if(scope == 'checkPlayerJoin'){
        if(!Array.isArray(postData.identifiers) || typeof postData.name !== 'string'){
            return ctx.utils.error(400, 'Invalid Request');
        }
        try {
            const resp = await globals.playerController.checkPlayerJoin(postData.identifiers, postData.name);
            if(resp.allow){
                return ctx.send('allow');
            }else{
                const msg = resp.reason || 'Access Denied for unknown reason';
                return ctx.send(`[txAdmin] ${msg}`);
            }
        } catch (error) {
            const msg = `[txAdmin] [JoinCheck] Failed with error: ${error.message}`;
            logError(msg);
            return ctx.send(msg);
        }

    }else{
        return ctx.send({
            type: 'danger',
            message: 'Unknown intercom scope.'
        });
    }

    return ctx.send({
        txAdminVersion: GlobalData.txAdminVersion,
        success: false
    });
};
