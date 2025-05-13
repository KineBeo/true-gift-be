import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { messagesEntity } from './infrastructure/persistence/relational/entities/messages.entity';
import { FriendsModule } from '../friends/friends.module';
import { MessagesProviders } from './providers';
import { MessagesGateway } from './messages.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '../common/cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([messagesEntity]),
    FriendsModule,
    CacheModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('AUTH_JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MessagesController],
  providers: [...MessagesProviders, MessagesGateway],
  exports: [MessagesProviders[0]],  // Export MessagesService
})
export class MessagesModule {}
