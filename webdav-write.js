const { createClient } = require('webdav');
const https = require('https');
const path = require('path');

module.exports = function (RED) {
  function WebDavWrite (config) {
    RED.nodes.createNode(this, config);
    this.server = RED.nodes.getNode(config.server);
    this.directory = config.directory;
    this.filename = config.filename;
    this.overwrite = config.overwrite;
    this.format = config.format;
    const node = this;

    function createParentDirectories(client, directory, option) {
      const parentDir = path.dirname(directory);
      if (parentDir === '/' || parentDir === directory) {
        return Promise.resolve(); // Base case: Stop recursion when parent directory is root or same as directory
      }
      return createParentDirectories(client, parentDir, option)
        .then(() => {
        node.log("creating directory " + directory);
          return client.createDirectory(directory, option)
            .catch(error => {
              if (error.response && error.response.status === 405) { // Directory already exists
                return Promise.resolve();
              }
              throw error;
            });
        });
    }

    node.on('input', (msg) => {
      // Read upload file
      let filename = node.filename;
      if (msg.filename) {
        filename = msg.filename;
      }
      const name = path.basename(filename); // Extracting filename
      const pathDirectory = path.dirname(filename);
      // Set upload directory
      let directory = '/';
      if (msg.directory) {
        directory = path.posix.join(directory, msg.directory); // Using path.join for proper directory concatenation
      } else if (node.directory && node.directory.length) {
        directory = path.posix.join(directory, node.directory); // Using path.join for proper directory concatenation
      }
      directory = path.posix.join(directory, pathDirectory); // add relative path from filename

      const webDavUri = node.server.address;
      const client = createClient(webDavUri, {
        username: node.server.credentials.user,
        password: node.server.credentials.pass
      });

      // check option for self-signed certs
      const option = {
        format: node.format
      };
      if (node.server.insecure) {
        option.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      }
      if (node.overwrite) {
        option.overwrite = true;
      }

      createParentDirectories(client, directory, option)
        .then(() => {
          node.log("Uploading file " + name + " To directory " + directory);
          return client.putFileContents(path.posix.join(directory, name), msg.payload, option) // Using path.join for proper file path
            .then(function (content) {
              node.send(Object.assign({}, msg,
                {
                  status: content.status,
                  statusText: content.statusText
                }));
            });
        })
        .catch(function (error) {
          node.error(error.toString(), msg);
        });
    });
  }
  RED.nodes.registerType('webdav-write', WebDavWrite);
};
