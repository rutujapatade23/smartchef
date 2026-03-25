import axios from 'axios';

const client = axios.create({
  baseURL: '', // Proxy handles this
  withCredentials: true,
});

export default client;
