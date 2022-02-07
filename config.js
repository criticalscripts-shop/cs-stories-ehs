// Critical Scripts | https://criticalscripts.shop

module.exports = {
    // The port the hosting server will listen to, this port needs to be allowed in the hosting server's firewall on TCP protocol.
    port: 35540,

    // The IP address the hosting server will listen to, leave this to null to automatically listen on all network interfaces.
    listeningIpAddress: null,

    // This is the authentication key, the exact same needs to be set in the resource's config so they match up.
    authKey: null,

    // The maximum size of a story's video in MB.
    // The default value (5) is enough for 30 seconds of the maxDuration property (in the resource's configuration).
    // If you decide to change this, don't forge to adjust the maxDuration property (in the resource's configuration) accordingly.
    maxSize: 5,

    // This is an arbitary maximum limit of how many stories the server will store.
    // If this number is reached new stories will be rejected.
    // The default value (1000) implies that stories will take at most 5GB of disk space (with an approximate maximum size of a story equal to 5MB) when using the default maxSize property value (5).
    // If you have maxVideoStorageTime property set to nil (unlimited) in the resource's configuration then this value may be useful to prevent disk space exhaustion.
    maximumStoriesStored: 1000
}
