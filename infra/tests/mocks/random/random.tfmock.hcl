# Shared mock values for `mock_provider "random"` in every `terraform test` under infra/.
# A mocked random_password.result would be a short random string, shorter than some arguments
# accept (an ElastiCache auth token needs 16 to 128 characters), so it gets a 48-character value
# with no special characters. Every mocked password is this same value: a test that needs two
# different values (for example SESSION_SECRET and LINK_SIGNING_SECRET) uses `override_resource`.

mock_resource "random_password" {
  defaults = {
    result = "MockPassword0123456789abcdefghijklmnopqrstuvwxyz"
  }
}
