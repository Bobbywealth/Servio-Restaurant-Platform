const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
};

jest.mock('../services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: () => ({
      getDatabase: async () => mockDb
    })
  }
}));

type MockReq = {
  body?: Record<string, any>;
  query?: Record<string, any>;
};

const createMockRes = () => {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
};

describe('bookings routes', () => {
  let createBookingHandler: any;
  let getBookingsHandler: any;

  beforeAll(async () => {
    const routeModule = await import('./bookings');
    createBookingHandler = routeModule.createBookingHandler;
    getBookingsHandler = routeModule.getBookingsHandler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a booking successfully', async () => {
    mockDb.get
      .mockResolvedValueOnce({ name: 'demo_bookings' })
      .mockResolvedValueOnce({ total: 0 });
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    const req = {
      body: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+15551234567',
        restaurantName: 'Demo Diner',
        bookingDate: '2026-04-21',
        bookingTime: '13:30',
        timezone: 'America/New_York',
        notes: 'Needs patio seating'
      }
    } as MockReq;
    const res = createMockRes();

    await createBookingHandler(req as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.booking).toEqual({
      booking_date: '2026-04-21',
      booking_time: '13:30',
      timezone: 'America/New_York'
    });
    expect(mockDb.run).toHaveBeenCalledTimes(1);
  });

  it('returns conflict when slot already exists', async () => {
    mockDb.get
      .mockResolvedValueOnce({ name: 'demo_bookings' })
      .mockResolvedValueOnce({ total: 1 });

    const req = {
      body: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        bookingDate: '2026-04-21',
        bookingTime: '13:30',
        timezone: 'America/New_York'
      }
    } as MockReq;
    const res = createMockRes();

    await createBookingHandler(req as any, res as any);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('SLOT_CONFLICT');
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('returns validation errors for invalid payload', async () => {
    const req = {
      body: {
        name: '',
        email: 'invalid-email',
        bookingDate: '04/21/2026',
        bookingTime: '1:99',
        timezone: 'Invalid/TZ',
        phone: 'abc123'
      }
    } as MockReq;
    const res = createMockRes();

    await createBookingHandler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid booking payload');
    expect(res.body.details).toEqual(expect.arrayContaining([
      'name is required',
      'email must be a valid email address',
      'phone must be a valid phone number',
      'bookingDate must be in YYYY-MM-DD format',
      'bookingTime must be in HH:mm 24-hour format',
      'timezone must be a valid IANA timezone'
    ]));
  });

  it('returns bookings for date range reads', async () => {
    mockDb.get.mockResolvedValueOnce({ name: 'demo_requests' });
    mockDb.all.mockResolvedValueOnce([
      { booking_date: '2026-04-21', booking_time: '13:30' },
      { booking_date: '2026-04-22', booking_time: '09:00' }
    ]);

    const req = {
      query: {
        start: '2026-04-01',
        end: '2026-04-30'
      }
    } as MockReq;
    const res = createMockRes();

    await getBookingsHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.bookings).toHaveLength(2);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('FROM demo_requests'),
      ['2026-04-01', '2026-04-30']
    );
  });
});
