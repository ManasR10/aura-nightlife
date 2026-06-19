module.exports = {
  createThumbnail: jest.fn(() => Promise.resolve({ path: 'mock-thumbnail.jpg' })),
};
