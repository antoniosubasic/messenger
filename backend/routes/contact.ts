import express, { Router } from 'express';
import { DbSession } from '../db';
import { StatusCodes } from 'http-status-codes';
import { getContacts } from '../utilities/contact';

export const contactRouter = Router();


contactRouter.get('/', async (_ , res) =>{
   
});

