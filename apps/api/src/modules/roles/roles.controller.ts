import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  RoleCreateInput,
  RoleIdParams,
  RolePermissionsInput,
  RoleUpdateInput,
} from '@quad/contracts';

import { PermissionsService } from '../../common/access/permissions.service';
import { Can } from '../../common/guards/can.decorator';
import { Auth } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';

import { RolesService } from './roles.service';

import type { RequestAuth } from '../../common/session/request-auth';
import type { Role, RoleList } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/** Users & roles → Roles & permissions (spec 06 School settings and people; spec 08). */
@Controller('roles')
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly access: PermissionsService,
  ) {}

  /** The Preview card and the Roles page read it; settings viewers too (any-of). */
  @Get()
  @Can('users.manage', 'settings.view')
  list(@Auth() auth: RequestAuth): Promise<RoleList> {
    return this.roles.list(auth);
  }

  @Post()
  @Can('users.manage')
  @HttpCode(201)
  async create(
    @Auth() auth: RequestAuth,
    @Body(new ZodValidationPipe(RoleCreateInput)) body: RoleCreateInput,
    @Req() request: FastifyRequest,
  ): Promise<Role> {
    return this.roles.create(auth, await this.access.forRequest(request), body, request.ip);
  }

  @Patch(':id')
  @Can('users.manage')
  update(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(RoleIdParams)) params: RoleIdParams,
    @Body(new ZodValidationPipe(RoleUpdateInput)) body: RoleUpdateInput,
    @Req() request: FastifyRequest,
  ): Promise<Role> {
    return this.roles.update(auth, params.id, body, request.ip);
  }

  @Delete(':id')
  @Can('users.manage')
  @HttpCode(204)
  async delete(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(RoleIdParams)) params: RoleIdParams,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.roles.delete(auth, params.id, request.ip);
  }

  @Put(':id/permissions')
  @Can('users.manage')
  async setPermissions(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(RoleIdParams)) params: RoleIdParams,
    @Body(new ZodValidationPipe(RolePermissionsInput)) body: RolePermissionsInput,
    @Req() request: FastifyRequest,
  ): Promise<Role> {
    const access = await this.access.forRequest(request);
    return this.roles.setPermissions(auth, access, params.id, body, request.ip);
  }
}
