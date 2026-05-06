import { app } from '../express'

app.get('/auth', async (req, res) => {
  res.status(200).send({ status: 200, message: 'ok' })
})

app.get('/auth/:token', async (req, res) => {
  res.status(200).send({ status: 200, message: 'ok' })
})

app.post('/auth', async (req, res) => {
  res.status(200).send({ status: 200, message: 'ok' })
})
