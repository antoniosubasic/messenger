import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { userRouter } from './routes/user';
import { DbSession } from './db';
import { fileURLToPath } from 'url';
import { contactRouter } from './routes/contact';

dotenv.config({
    path: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../.env'
    ),
});

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_, res) => {
    res.send('success');
});

app.use('/user', userRouter);
app.use('/contact', contactRouter)

if (!process.env.BACKEND_PORT) {
    throw new Error('BACKEND_PORT is not set');
}

app.listen(process.env.BACKEND_PORT, async () => {
    await DbSession.ensureTablesCreated();
    console.log(`running on http://localhost:${process.env.BACKEND_PORT}`);
});
