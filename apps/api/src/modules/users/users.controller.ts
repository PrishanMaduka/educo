import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { StaffInviteInput, StaffListQuery, StaffUpdateInput, UserIdParams } from '@quad/contracts';

import { PermissionsService } from '../../common/access/permissions.service';
import { Can } from '../../common/guards/can.decorator';
import { Auth } from '../../common/session/request-auth';
import { ZodValidationPipe } from '../../common/zod.pipe';

import { InvitesService } from './invites.service';
import { UsersService } from './users.service';

import type { RequestAuth } from '../../common/session/request-auth';
import type { StaffInviteResult, StaffList, StaffMember } from '@quad/contracts';
import type { FastifyRequest } from 'fastify';

/** Users & roles → Staff accounts (spec 06 School settings and people; spec 08). */
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly invites: InvitesService,
    private readonly access: PermissionsService,
  ) {}

  @Get()
  @Can('users.manage')
  list(
    @Auth() auth: RequestAuth,
    @Query(new ZodValidationPipe(StaffListQuery)) query: StaffListQuery,
  ): Promise<StaffList> {
    return this.users.list(auth, query);
  }

  @Post('invite')
  @Can('users.manage')
  @HttpCode(201)
  async invite(
    @Auth() auth: RequestAuth,
    @Body(new ZodValidationPipe(StaffInviteInput)) body: StaffInviteInput,
    @Req() request: FastifyRequest,
  ): Promise<StaffInviteResult> {
    return this.invites.invite(auth, await this.access.forRequest(request), body, request.ip);
  }

  @Patch(':id')
  @Can('users.manage')
  async update(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(UserIdParams)) params: UserIdParams,
    @Body(new ZodValidationPipe(StaffUpdateInput)) body: StaffUpdateInput,
    @Req() request: FastifyRequest,
  ): Promise<StaffMember> {
    const access = await this.access.forRequest(request);
    return this.users.update(auth, access, params.id, body, request.ip);
  }

  @Post(':id/remind-two-step')
  @Can('users.manage')
  @HttpCode(202)
  async remindTwoStep(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(UserIdParams)) params: UserIdParams,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.users.remindTwoStep(auth, params.id, request.ip);
  }

  @Post(':id/reset-password')
  @Can('users.manage')
  @HttpCode(202)
  async resetPassword(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(UserIdParams)) params: UserIdParams,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.users.resetPassword(auth, params.id, request.ip);
  }

  @Post(':id/sign-out-everywhere')
  @Can('users.manage')
  @HttpCode(204)
  async signOutEverywhere(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(UserIdParams)) params: UserIdParams,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.users.signOutEverywhere(auth, params.id, request.ip);
  }

  @Post(':id/resend-invite')
  @Can('users.manage')
  @HttpCode(202)
  async resendInvite(
    @Auth() auth: RequestAuth,
    @Param(new ZodValidationPipe(UserIdParams)) params: UserIdParams,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.invites.resend(auth, params.id, request.ip);
  }
}
