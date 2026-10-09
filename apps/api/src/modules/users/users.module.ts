import { Module } from '@nestjs/common';

import { InvitesController } from '../../public/signed-links/invites.controller';
import { RolesController } from '../roles/roles.controller';
import { RolesRepository } from '../roles/roles.repository';
import { RolesService } from '../roles/roles.service';

import { InvitesService } from './invites.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Users & roles (spec 06 School settings and people; spec 08): staff accounts, invitations and
 * roles (`modules/roles`), and the tenant-less invite link's controller in
 * `src/public/signed-links` (ruling F14). Sign-in services come from `AuthModule`.
 */
@Module({
  controllers: [UsersController, RolesController, InvitesController],
  providers: [UsersService, UsersRepository, InvitesService, RolesService, RolesRepository],
})
export class UsersModule {}
