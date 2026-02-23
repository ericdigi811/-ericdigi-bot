import fs from 'fs/promises';
import path from 'path';
import { Contact, Stats } from '../shared/schema';

const CONTACTS_FILE = path.join(process.cwd(), 'contacts.json');

export interface IStorage {
  getContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactByPhone(phone: string): Promise<Contact | undefined>;
  createContact(contact: Contact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact>;
  getStats(): Promise<Stats>;
  updateStats(updates: Partial<Stats>): Promise<Stats>;
}

export class JsonStorage implements IStorage {
  private stats: Stats = {
    botStatus: "disconnected",
    totalContacts: 0,
    messagesSentToday: 0,
    conversionRate: 0,
    lastSync: new Date().toISOString()
  };

  private async ensureFile() {
    try {
      await fs.access(CONTACTS_FILE);
    } catch {
      await fs.writeFile(CONTACTS_FILE, JSON.stringify([]));
    }
  }

  async getContacts(): Promise<Contact[]> {
    await this.ensureFile();
    const data = await fs.readFile(CONTACTS_FILE, 'utf-8');
    return JSON.parse(data);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const contacts = await this.getContacts();
    return contacts.find(c => c.id === id);
  }

  async getContactByPhone(phone: string): Promise<Contact | undefined> {
    const contacts = await this.getContacts();
    return contacts.find(c => c.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
  }

  async createContact(contact: Contact): Promise<Contact> {
    const contacts = await this.getContacts();
    contacts.push(contact);
    await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
    this.stats.totalContacts = contacts.length;
    return contact;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    const contacts = await this.getContacts();
    const index = contacts.findIndex(c => c.id === id);
    if (index === -1) throw new Error("Contact not found");
    
    contacts[index] = { ...contacts[index], ...updates };
    await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
    return contacts[index];
  }

  async getStats(): Promise<Stats> {
    const contacts = await this.getContacts();
    this.stats.totalContacts = contacts.length;
    return this.stats;
  }

  async updateStats(updates: Partial<Stats>): Promise<Stats> {
    this.stats = { ...this.stats, ...updates };
    return this.stats;
  }
}

export const storage = new JsonStorage();