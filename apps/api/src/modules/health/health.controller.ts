import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthReport, HealthService } from './health.service';

@ApiTags('Health')
// Never rate-limited: Render's health checks and the web app's wake-up poll must always get an answer.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and dependency check (Postgres and Redis)' })
  @ApiResponse({ status: 200, description: 'API, database and Redis are up' })
  @ApiResponse({ status: 503, description: 'The database or Redis is down' })
  async check(): Promise<HealthReport> {
    const report = await this.healthService.check();
    if (report.status !== 'ok') {
      // The report itself becomes the 503 body, so callers see which dependency failed.
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
