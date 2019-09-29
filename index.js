const app = require('express')()
const server = require('http').createServer(app)
const proxy = require('http-proxy').createProxyServer()
const io = require('socket.io')(server)

app.use((req, res) => {
  proxy.web(req, res, { target: 'http://web:8000' })

  const [endpoint, queryParams] = req.originalUrl.split('?')

  res.proxyWs = {}
  res.proxyWs.endpoint = endpoint
  res.proxyWs.method = req.method

  if (queryParams) {
    const params = {}
    queryParams.split('&').forEach(p => {
      const [key, value] = p.split('=')
      params[key] = value
    })
    res.proxyWs.params = params
  }

  req.on('data', (dataBuffer) => {
    try {
      res.proxyWs.in = JSON.parse(dataBuffer)
    } catch (e) {}
  })
})

proxy.on('proxyRes', (proxyRes, req, res) => {
  let out = ''
  proxyRes.on('data', (dataBuffer) => {
    if (!res.proxyWs) { return }
    res.proxyWs.status = res.statusCode
    res.proxyWs.statusMessage = res.statusMessage
    try {
      out += dataBuffer.toString()
    } catch (e) {}
  })

  proxyRes.on('end', () => {
    if (!res.proxyWs) { return }
    try {
      res.proxyWs.out = JSON.parse(out)
      io.emit('request', res.proxyWs)
    } catch (e) {}
  })
})

proxy.on('error', function (err, req, res) {
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end();
});

io.on('connection', (socket) => {
  console.log('A user connected')
  socket.on('disconnect', () => {
    console.log('A user disconnected')
  })
})

server.listen(8000, () => {
  console.log('Server running on port 8000')
})
