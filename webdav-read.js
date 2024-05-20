const { createClient } = require('webdav')
const https = require('https')

module.exports = function (RED) {
  function WebDavOut (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.filename = config.filename
    this.output = config.output
    const node = this

    node.on('input', (msg) => {
      const webDavUri = node.server.address
      const client = createClient(webDavUri, {
        username: node.server.credentials.user,
        password: node.server.credentials.pass
      })
      let filename = ''
      if (msg.filename) {
        filename = '/' + msg.filename
      } else if (node.filename && node.filename.length) {
        filename = '/' + node.filename
      } else {
        node.error('WebDAV -> no filename specified.', msg)
        return
      }
      filename = filename.replace('//', '/')

      // check option for self signed certs
      const option = {
        format: node.output
      }
      if (node.server.insecure) {
        option.httpsAgent = new https.Agent({ rejectUnauthorized: false })
      }
      client.getFileContents(filename, option)
        .then(function (contents) {
          console.log(contents)
          node.send({
            ...msg,
            payload: contents
          })
        }, function (error) {
          node.error(error.toString(), msg)
        })
    })
  }
  RED.nodes.registerType('webdav-read', WebDavOut)
}
