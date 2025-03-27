import express, { Router } from 'express';
import { DbSession } from '../db';
import { StatusCodes } from 'http-status-codes';
import { getContacts } from '../utilities/contact';

export const contactRouter = Router();


contactRouter.get('/:id', async (req, res) =>{
   const id = req.params.id;
   // Validation beeing done in the get Contacts class
   try {
      const contacts = await getContacts(parseInt(id,10));

      res.status(StatusCodes.OK).json(contacts)
   } catch (error) {
      res.status(StatusCodes.BAD_REQUEST).json({"Error" : "There was and error while getting the data form the DB : " + error})
   } 

});

