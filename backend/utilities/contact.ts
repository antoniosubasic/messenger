import { DbSession } from '../db';
import { User } from '../models/user';

/**
 * Gets the contacts of the Person which ID was provided 
 * @param ID The ID of the given User which indicates which messages he sent 
 * @returns A Array of Users, if the Array is empty the User has no contacts.
 */
export async function getContacts(ID: number): Promise<User[]> {

   if (!ID || ID <= 0 || !Number.isInteger(ID)) {
      throw new Error('Invalid user ID provided');
   }

   const db = await DbSession.create(false);
   try {
      let query = `
         SELECT uid from user where uid = $1 
      `;

      const userResult = await db.query(query, [ID]);

      if (userResult.rows.length === 0) {
         throw new Error('Invalid user ID provided. User was not found in the Database');
      }

      // Second query to get contacts
      query = `
        SELECT DISTINCT u.* 
        FROM users u
          INNER JOIN messages m ON (m.sender_id = $1 AND m.receiver_id = u.id) 
            OR (m.receiver_id = $1 AND m.sender_id = u.id)
          WHERE u.id != $1
        ORDER BY u.username ASC`;

      const contactsResult = await db.query(query, [ID]);

      return contactsResult.rows.map(row => ({
         uid: row.uid,
         username: row.username,
         created_at: row.created_at
      }));

   } catch (error) {
      console.error(error);
      return [];
   } finally {
      await db.complete();
   }

}
