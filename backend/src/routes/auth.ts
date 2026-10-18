import { Router } from 'express';
import {
  authenticateUser,
  registerUser,
  findUserById,
} from '../services/authService.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const authRouter = Router();

/**
 * POST /api/auth/register — Cadastrar um novo usuário
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { username, password, name } = req.body as {
      username?: string;
      password?: string;
      name?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: 'Nickname e senha são obrigatórios.' });
      return;
    }

    const newUser = await registerUser({ username, password, name });
    const { token } = await authenticateUser(newUser.username, password);

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
      },
      token,
    });
  } catch (err: any) {
    const message = err.message || 'Erro ao registrar usuário.';
    const status = message.includes('já está cadastrado') ? 409 : 400;
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/auth/login — Autenticar com nickname e senha
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: 'Informe o nickname e a senha.' });
      return;
    }

    const { user, token } = await authenticateUser(username, password);

    res.json({
      message: 'Login realizado com sucesso!',
      user,
      token,
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Falha no login.' });
  }
});

/**
 * GET /api/auth/me — Obter perfil do usuário autenticado pela sessão
 */
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao obter dados do usuário.' });
  }
});

/**
 * POST /api/auth/logout — Encerrar sessão
 */
authRouter.post('/logout', (_req, res) => {
  res.json({ message: 'Sessão encerrada com sucesso.' });
});
