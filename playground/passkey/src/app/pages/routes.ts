import { route } from 'rwsdk/router';
import { Login } from './Login.js';
import { Home } from './Home.js';

export const routes = [
  route('/', [Home]),
  route('/login', [Login]),
];
