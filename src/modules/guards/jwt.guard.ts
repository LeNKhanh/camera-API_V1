// JwtAuthGuard: Custom guard that supports two modes:
// 1) SSO mode (when SSO_API_KEY is set): validate incoming Bearer token either via
//    SSO introspection endpoint (SSO_INTROSPECT_URL) or by decoding JWT and
//    checking the client/audience claim matches SSO_CLIENT_ID. The user's id is
//    taken from the token's `sub` claim.
// 2) Local JWT mode (default): verify token using JwtService and JWT_SECRET.

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { User, UserRole } from '../../typeorm/entities/user.entity';

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(
		private readonly jwtService: JwtService,
		@InjectRepository(User) private readonly usersRepo: Repository<User>,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest();
		const auth = req.headers?.authorization || req.headers?.Authorization;
		if (!auth || typeof auth !== 'string') throw new UnauthorizedException('Missing Authorization header');

		const parts = auth.split(' ');
		if (parts.length !== 2 || parts[0] !== 'Bearer') throw new UnauthorizedException('Invalid Authorization header');
		const token = parts[1].trim();

		const ssoApiKey = process.env.SSO_API_KEY;
		const ssoClientId = process.env.SSO_CLIENT_ID;
		const ssoIntrospect = process.env.SSO_INTROSPECT_URL;

		if (ssoApiKey) {
			// SSO mode
			try {
				let claims: any = null;
				if (ssoIntrospect) {
					// Call introspection endpoint to validate token
					const resp = await axios.post(
						ssoIntrospect,
						{ token },
						{ headers: { 'x-api-key': ssoApiKey, 'content-type': 'application/json' }, timeout: 5000 },
					);
					if (!resp || !resp.data) throw new UnauthorizedException('SSO introspection failed');
					// Expect response.data.active or a payload with claims
					if (resp.data.active === false) throw new UnauthorizedException('SSO token inactive');
					// If introspection returns claims directly, use them; otherwise resp.data might contain 'claims'
					claims = resp.data.claims || resp.data;
				} else {
					// No introspection URL: decode token WITHOUT verifying signature and trust SSO client id
					const decoded = this.jwtService.decode(token) as any;
					if (!decoded) throw new UnauthorizedException('Invalid token');
					claims = decoded;
					if (ssoClientId) {
						const audOk = (decoded.aud === ssoClientId) || (decoded.azp === ssoClientId) || (decoded.client_id === ssoClientId) || (Array.isArray(decoded.aud) && decoded.aud.includes(ssoClientId));
						if (!audOk) throw new UnauthorizedException('Token audience/client mismatch for SSO');
					}
				}

				if (!claims || !claims.sub) throw new UnauthorizedException('SSO token missing sub claim');
				
				// Auto-provision user: ensure user exists in local DB (upsert by sub)
				await this.ensureUserExists(claims.sub, claims.username || claims.name || claims.preferred_username || 'sso-user', claims.role || claims.roles);
				
				// Attach user to request: use sub as primary user id
				req.user = { userId: claims.sub, username: claims.username || claims.name || '', role: claims.role || claims.roles || 'ADMIN', rawClaims: claims };
				return true;
			} catch (e) {
				throw new UnauthorizedException((e as any)?.message || 'SSO validation failed');
			}
		}

		// Local JWT mode: verify signature using JwtService (reads JWT_SECRET)
		try {
			const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'dev_secret' }) as any;
			if (!payload || !payload.sub) throw new UnauthorizedException('Invalid JWT payload');
			req.user = { userId: payload.sub, username: payload.username || '', role: payload.role || 'ADMIN' };
			return true;
		} catch (e) {
			throw new UnauthorizedException('Invalid or expired token');
		}
	}

	/**
	 * Auto-provision: ensure user exists in DB with given sub as primary key.
	 * If user doesn't exist, create one. If exists, optionally update username/role.
	 */
	private async ensureUserExists(sub: string, username: string, roleClaim?: any): Promise<void> {
		let user = await this.usersRepo.findOne({ where: { id: sub } });
		if (!user) {
			// Determine role from SSO claims or default to ADMIN
			let role: UserRole = 'ADMIN';
			if (roleClaim) {
				const roleStr = Array.isArray(roleClaim) ? roleClaim[0] : roleClaim;
				if (roleStr === 'ADMIN' || roleStr === 'OPERATOR' || roleStr === 'VIEWER') {
					role = roleStr as UserRole;
				}
			}
			// Default SSO role from env
			const defaultRole = (process.env.SSO_DEFAULT_ROLE || 'ADMIN') as UserRole;
			if (!roleClaim) role = defaultRole;

			// Create user with sub as id, no password (SSO users don't have local passwords)
			user = this.usersRepo.create({
				id: sub,
				username,
				passwordHash: '', // SSO users have no local password
				role,
			});
			await this.usersRepo.save(user);
		} else {
			// Optionally update username if changed (or skip if you prefer immutable usernames)
			// if (user.username !== username) {
			//   user.username = username;
			//   await this.usersRepo.save(user);
			// }
		}
	}
}
